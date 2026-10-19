using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Categoria;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace ControleFinanceiro.Api.Services
{
    /// <summary>
    /// Categorias: as padrão (UsuarioId null) todo mundo vê e ninguém mexe; as do usuário ele cria, edita e exclui.
    /// Excluir uma categoria EM USO move tudo que aponta pra ela (lançamentos, contas fixas, parcelamentos, limites
    /// e metas) pra outra que a pessoa escolhe, e leva junto as subcategorias, numa transação só (decisão do
    /// Gustavo, 2026-10-16, modelo Monarch/Organizze). Antes excluir em uso dava 500 (FK sem ação) e, se passasse,
    /// limite e meta viravam "geral" calados.
    /// </summary>
    public class CategoriaService
    {
        public const int NomeMax = 100; // docs/REGRAS_CAMPOS.md: nome curto
        public const string MensagemNomeRepetido = "Já existe uma categoria com esse nome.";
        public const string MensagemPadraoNaoMuda = "Categoria padrão não pode ser alterada nem excluída.";
        public const string MensagemEscolhaDestino = "Essa categoria está em uso. Escolha pra qual categoria os lançamentos vão.";
        public const string MensagemCorrida = "Entrou um lançamento novo nessa categoria agora. Tente de novo.";

        private readonly AppDbContext _context;

        public CategoriaService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<Categoria>> ListarAsync(Guid usuarioId)
        {
            return await _context.Categorias
                .Where(c => c.UsuarioId == null || c.UsuarioId == usuarioId)
                .OrderBy(c => c.UsuarioId == null ? 0 : 1) // padrões primeiro
                .ThenBy(c => c.Descricao)
                .AsNoTracking()
                .ToListAsync();
        }

        public async Task<Categoria?> BuscarPorIdAsync(Guid id, Guid usuarioId)
        {
            return await _context.Categorias
                .FirstOrDefaultAsync(c => c.Id == id && (c.UsuarioId == null || c.UsuarioId == usuarioId));
        }

        public async Task<Categoria> CriarAsync(Categoria categoria, Guid usuarioId)
        {
            var nome = ValidarNome(categoria.Descricao);
            ValidarFinalidade(categoria.Finalidade);
            await ExigirNomeLivreAsync(nome, usuarioId, ignorarId: null);

            categoria.Id = Guid.NewGuid();
            categoria.Descricao = nome;
            categoria.UsuarioId = usuarioId;

            _context.Categorias.Add(categoria);
            await _context.SaveChangesAsync();

            return categoria;
        }

        /// <summary>
        /// Renomeia e/ou troca o tipo. O tipo novo tem que aceitar o que já está nela (ex.: não vira "só receita"
        /// com despesa lançada) — senão o lançamento ficava numa categoria que não serve pra ele.
        /// </summary>
        public async Task<Categoria> AtualizarAsync(Guid id, string descricao, Finalidade finalidade, Guid usuarioId)
        {
            var categoria = await BuscarDoUsuarioParaMudarAsync(id, usuarioId);
            var nome = ValidarNome(descricao);
            ValidarFinalidade(finalidade);
            await ExigirNomeLivreAsync(nome, usuarioId, ignorarId: id);

            if (finalidade != categoria.Finalidade)
            {
                var (temDespesa, temReceita) = await TiposEmUsoAsync(id);
                if (!Aceita(finalidade, temDespesa, temReceita))
                    throw new ArgumentException(temReceita && finalidade == Finalidade.Despesa
                        ? "Essa categoria tem receitas. Ela precisa continuar aceitando receita."
                        : "Essa categoria tem despesas. Ela precisa continuar aceitando despesa.");
            }

            categoria.Descricao = nome;
            categoria.Finalidade = finalidade;
            await _context.SaveChangesAsync();
            return categoria;
        }

        /// <summary>O que aponta pra categoria (do usuário) — a tela usa pra saber se pergunta o destino.</summary>
        public async Task<UsoCategoriaDto> UsoAsync(Guid id, Guid usuarioId)
        {
            if (await BuscarPorIdAsync(id, usuarioId) == null)
                throw new KeyNotFoundException("Categoria não encontrada.");
            return await ContarUsoAsync(id, usuarioId);
        }

        /// <summary>
        /// Exclui a categoria. Em uso, <paramref name="moverPara"/> é obrigatório: tudo que aponta pra ela passa pra
        /// lá (inclusive lançamento excluído, que segue no banco), as subcategorias dela vão junto (a de mesmo nome
        /// que já existe no destino absorve a dela) e os limites do mesmo mês somam. Tudo ou nada.
        /// </summary>
        public async Task<UsoCategoriaDto> DeletarAsync(Guid id, Guid usuarioId, Guid? moverPara = null)
        {
            var categoria = await BuscarDoUsuarioParaMudarAsync(id, usuarioId);
            var uso = await ContarUsoAsync(id, usuarioId);

            Categoria? destino = null;
            if (uso.PrecisaDestino || moverPara.HasValue)
            {
                if (moverPara is not { } destinoId)
                    throw new InvalidOperationException(MensagemEscolhaDestino);
                if (destinoId == id)
                    throw new ArgumentException("Escolha outra categoria pra receber os lançamentos.");
                destino = await BuscarPorIdAsync(destinoId, usuarioId)
                    ?? throw new KeyNotFoundException("Categoria de destino não encontrada.");
                var (temDespesa, temReceita) = await TiposEmUsoAsync(id);
                if (!Aceita(destino.Finalidade, temDespesa, temReceita))
                    throw new ArgumentException(temReceita && destino.Finalidade == Finalidade.Despesa
                        ? $"\"{destino.Descricao}\" é só de despesa e essa categoria tem receitas."
                        : $"\"{destino.Descricao}\" é só de receita e essa categoria tem despesas.");
            }

            var proprioTx = _context.Database.CurrentTransaction is null && _context.Database.IsRelational();
            await using var tx = proprioTx ? await _context.Database.BeginTransactionAsync() : null;
            try
            {
                if (destino != null)
                    await MoverTudoAsync(categoria, destino, usuarioId);

                _context.Categorias.Remove(categoria);
                await _context.SaveChangesAsync();
                if (tx != null) await tx.CommitAsync();
            }
            catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.ForeignKeyViolation })
            {
                // Outra requisição lançou nessa categoria entre o mover e o excluir: nada foi gravado (rollback).
                throw new InvalidOperationException(MensagemCorrida);
            }
            return uso;
        }

        // ── regras ─────────────────────────────────────────────────────────────

        private static string ValidarNome(string? descricao)
        {
            var nome = descricao?.Trim() ?? "";
            if (nome.Length == 0)
                throw new ArgumentException("Descrição é obrigatória.");
            if (nome.Length > NomeMax)
                throw new ArgumentException($"Descrição deve ter no máximo {NomeMax} caracteres.");
            return nome;
        }

        private static void ValidarFinalidade(Finalidade finalidade)
        {
            if (!Enum.IsDefined(finalidade))
                throw new ArgumentException("Tipo de categoria inválido.");
        }

        // Nome repetido (sem diferenciar maiúscula) entre as padrão e as do usuário confunde a escolha no lançamento.
        private async Task ExigirNomeLivreAsync(string nome, Guid usuarioId, Guid? ignorarId)
        {
            var chave = nome.ToLower();
            var existe = await _context.Categorias.AnyAsync(c =>
                (c.UsuarioId == null || c.UsuarioId == usuarioId) && c.Id != ignorarId && c.Descricao.ToLower() == chave);
            if (existe)
                throw new InvalidOperationException(MensagemNomeRepetido);
        }

        // Do usuário pra editar/excluir: padrão → 409; de outro usuário ou inexistente → 404 (não revela que existe).
        private async Task<Categoria> BuscarDoUsuarioParaMudarAsync(Guid id, Guid usuarioId)
        {
            var categoria = await _context.Categorias
                .FirstOrDefaultAsync(c => c.Id == id && (c.UsuarioId == null || c.UsuarioId == usuarioId))
                ?? throw new KeyNotFoundException("Categoria não encontrada.");
            if (categoria.UsuarioId == null)
                throw new InvalidOperationException(MensagemPadraoNaoMuda);
            return categoria;
        }

        private static bool Aceita(Finalidade f, bool temDespesa, bool temReceita) =>
            f == Finalidade.Ambas || ((!temDespesa || f == Finalidade.Despesa) && (!temReceita || f == Finalidade.Receita));

        // Tipos VIVOS na categoria (lançamento excluído não conta — a pessoa nem vê). Parcelamento é sempre despesa.
        private async Task<(bool despesa, bool receita)> TiposEmUsoAsync(Guid id)
        {
            var tiposTx = await _context.Transacoes.Where(t => t.CategoriaId == id).Select(t => t.Tipo).Distinct().ToListAsync();
            var tiposFixa = await _context.Recorrentes.Where(r => r.CategoriaId == id && r.ExcluidoEm == null).Select(r => r.Tipo).Distinct().ToListAsync();
            var temParcelamento = await _context.Parcelamentos.AnyAsync(p => p.CategoriaId == id);
            var tipos = tiposTx.Concat(tiposFixa).ToHashSet();
            return (tipos.Contains(TipoTransacao.Despesa) || temParcelamento, tipos.Contains(TipoTransacao.Receita));
        }

        private async Task<UsoCategoriaDto> ContarUsoAsync(Guid id, Guid usuarioId) => new()
        {
            LancamentosExcluidos = await _context.Transacoes.IgnoreQueryFilters().CountAsync(t => t.CategoriaId == id && !t.Ativo),
            PrecisaDestino = await TemReferenciaAsync(id),
            Lancamentos = await _context.Transacoes.CountAsync(t => t.CategoriaId == id),
            ContasFixas = await _context.Recorrentes.CountAsync(r => r.CategoriaId == id && r.ExcluidoEm == null),
            Parcelamentos = await _context.Parcelamentos.CountAsync(p => p.CategoriaId == id),
            Limites = await _context.Orcamentos.CountAsync(o => o.CategoriaId == id && o.UsuarioId == usuarioId),
            Metas = await _context.Metas.CountAsync(m => m.CategoriaId == id),
            Subcategorias = await _context.Subcategorias.CountAsync(s => s.CategoriaId == id),
        };

        // Qualquer linha apontando pra ela (inclusive lançamento excluído e conta fixa excluída) segura o DELETE.
        private async Task<bool> TemReferenciaAsync(Guid id) =>
            await _context.Transacoes.IgnoreQueryFilters().AnyAsync(t => t.CategoriaId == id)
            || await _context.Recorrentes.AnyAsync(r => r.CategoriaId == id)
            || await _context.Parcelamentos.IgnoreQueryFilters().AnyAsync(p => p.CategoriaId == id)
            || await _context.Orcamentos.AnyAsync(o => o.CategoriaId == id)
            || await _context.Metas.IgnoreQueryFilters().AnyAsync(m => m.CategoriaId == id)
            || await _context.Subcategorias.AnyAsync(s => s.CategoriaId == id);

        private async Task MoverTudoAsync(Categoria origem, Categoria destino, Guid usuarioId)
        {
            var de = origem.Id;
            var para = destino.Id;

            // Subcategorias vão junto: a que já existe no destino com o mesmo nome absorve a da origem.
            var subsOrigem = await _context.Subcategorias.Where(s => s.CategoriaId == de).ToListAsync();
            var subsDestino = await _context.Subcategorias
                .Where(s => s.CategoriaId == para && (s.UsuarioId == null || s.UsuarioId == usuarioId))
                .ToListAsync();
            var trocaSub = new Dictionary<Guid, Guid>();
            foreach (var sub in subsOrigem)
            {
                var igual = subsDestino.FirstOrDefault(d => string.Equals(d.Nome.Trim(), sub.Nome.Trim(), StringComparison.OrdinalIgnoreCase));
                if (igual != null) trocaSub[sub.Id] = igual.Id;
                else sub.CategoriaId = para;
            }

            Guid? NovaSub(Guid? atual) => atual is { } s && trocaSub.TryGetValue(s, out var nova) ? nova : atual;

            foreach (var t in await _context.Transacoes.IgnoreQueryFilters().Where(t => t.CategoriaId == de).ToListAsync())
            {
                t.CategoriaId = para;
                t.SubcategoriaId = NovaSub(t.SubcategoriaId);
            }
            // Lançamento de outra categoria que usa uma subcategoria absorvida (não deveria existir, mas a FK é SetNull).
            if (trocaSub.Count > 0)
            {
                var absorvidas = trocaSub.Keys.ToList();
                foreach (var t in await _context.Transacoes.IgnoreQueryFilters()
                             .Where(t => t.SubcategoriaId != null && absorvidas.Contains(t.SubcategoriaId.Value) && t.CategoriaId != de)
                             .ToListAsync())
                    t.SubcategoriaId = NovaSub(t.SubcategoriaId);
                foreach (var p in await _context.Parcelamentos.IgnoreQueryFilters()
                             .Where(p => p.SubcategoriaId != null && absorvidas.Contains(p.SubcategoriaId.Value) && p.CategoriaId != de)
                             .ToListAsync())
                    p.SubcategoriaId = NovaSub(p.SubcategoriaId);
            }
            foreach (var r in await _context.Recorrentes.Where(r => r.CategoriaId == de).ToListAsync())
            {
                r.CategoriaId = para;
                r.SubcategoriaId = NovaSub(r.SubcategoriaId);
            }
            foreach (var p in await _context.Parcelamentos.IgnoreQueryFilters().Where(p => p.CategoriaId == de).ToListAsync())
            {
                p.CategoriaId = para;
                p.SubcategoriaId = NovaSub(p.SubcategoriaId);
            }
            foreach (var m in await _context.Metas.IgnoreQueryFilters().Where(m => m.CategoriaId == de).ToListAsync())
                m.CategoriaId = para;

            // Limite vale todo mês até mudar (cada linha = "deste mês em diante"): juntar as duas categorias é somar
            // o que valia em cada mês, de cada pessoa. Só somar as linhas do mesmo mês dava errado no mês seguinte.
            var limites = await _context.Orcamentos.Where(o => o.CategoriaId == de || o.CategoriaId == para).ToListAsync();
            static int Chave(Orcamento o) => o.Ano * 12 + o.Mes;
            static decimal Vale(List<Orcamento> linhas, int chave) =>
                linhas.Where(o => Chave(o) <= chave).MaxBy(Chave)?.ValorLimite ?? 0m;
            foreach (var daPessoa in limites.GroupBy(o => o.UsuarioId))
            {
                var limOrigem = daPessoa.Where(o => o.CategoriaId == de).ToList();
                if (limOrigem.Count == 0) continue;
                var limDestino = daPessoa.Where(o => o.CategoriaId == para).ToList();
                // Primeiro a linha do tempo somada (lendo os valores de antes), depois grava.
                var somada = new List<(int Chave, decimal Valor)>();
                foreach (var chave in daPessoa.Select(Chave).Distinct().Order())
                {
                    var v = Vale(limOrigem, chave) + Vale(limDestino, chave);
                    if (somada.Count == 0 ? v == 0m : somada[^1].Valor == v) continue;
                    somada.Add((chave, v));
                }
                var mantidas = new HashSet<Orcamento>();
                foreach (var (chave, valor) in somada)
                {
                    // Reaproveita a linha do limDestino daquele mês (o índice único é por categoria + mês).
                    var linha = limDestino.FirstOrDefault(o => Chave(o) == chave);
                    if (linha is null)
                    {
                        linha = new Orcamento { Id = Guid.NewGuid(), UsuarioId = daPessoa.Key, CategoriaId = para, Ano = (chave - 1) / 12, Mes = (chave - 1) % 12 + 1 };
                        _context.Orcamentos.Add(linha);
                    }
                    linha.ValorLimite = valor;
                    linha.AtualizadoEm = DateTime.UtcNow;
                    mantidas.Add(linha);
                }
                _context.Orcamentos.RemoveRange(limOrigem);
                _context.Orcamentos.RemoveRange(limDestino.Where(o => !mantidas.Contains(o)));
            }

            await _context.SaveChangesAsync();

            // As absorvidas saem depois que ninguém aponta mais pra elas.
            foreach (var sub in subsOrigem.Where(s => trocaSub.ContainsKey(s.Id)))
                _context.Subcategorias.Remove(sub);
        }
    }
}
