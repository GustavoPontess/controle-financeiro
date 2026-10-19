using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Meta;
using ControleFinanceiro.Api.DTOs.Transferencia;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Metas no modelo de CAIXINHA (como o Nubank; decisão do Gustavo em 2026-10-19): cada meta tem a própria conta
/// (<see cref="TipoConta.Caixinha"/>), criada junto com ela. Guardar = transferência de verdade da conta da pessoa
/// pra caixinha; resgatar = da caixinha pra conta. O dinheiro SAI da conta de origem (o saldo dela cai) e o
/// histórico da meta são essas transferências. Guardado = saldo da caixinha (<see cref="RegrasFinanceiras"/>).
/// Guardar não passa do saldo da conta; resgatar não passa do guardado. Idempotency-Key obrigatória (a mesma
/// regra da transferência: repetir devolve o original, outros dados → 409).
/// </summary>
public class MetaService
{
    /// <summary>Ícones que a tela oferece (o front mostra o desenho de cada um).</summary>
    public static readonly HashSet<string> Icones =
        ["alvo", "emergencia", "viagem", "casa", "carro", "estudos", "presente", "saude", "pet", "festa", "celular", "bebe"];

    private readonly AppDbContext _context;
    private readonly TransferenciaService _transferencias;

    public MetaService(AppDbContext context, TransferenciaService transferencias)
    {
        _context = context;
        _transferencias = transferencias;
    }

    // ── Criar / editar / excluir ─────────────────────────────────────────────

    /// <summary>Cria a meta e a caixinha dela (uma conta do tipo Caixinha com o nome da meta).</summary>
    public async Task<MetaDto> CriarAsync(CriarMetaDto dto, Guid usuarioId)
    {
        if (dto.FamiliaId.HasValue)
            await ExigirMembroAsync(dto.FamiliaId.Value, usuarioId);
        if (dto.CategoriaId.HasValue)
            await DonoRecursos.ExigirCategoriaAsync(_context, dto.CategoriaId.Value, usuarioId);
        var nome = ValidarNome(dto.Nome);

        var meta = new Meta
        {
            Id = Guid.NewGuid(),
            Nome = nome,
            Descricao = string.IsNullOrWhiteSpace(dto.Descricao) ? null : dto.Descricao.Trim(),
            Icone = ValidarIcone(dto.Icone),
            ValorAlvo = dto.ValorAlvo,
            DataLimite = NormalizarPrazo(dto.DataLimite, permitirPassado: false),
            UsuarioId = usuarioId,
            FamiliaId = dto.FamiliaId,
            CategoriaId = dto.CategoriaId,
        };
        meta.ContaId = NovaCaixinha(nome, usuarioId).Id;
        _context.Metas.Add(meta);
        await _context.SaveChangesAsync();
        return Montar(meta, 0m, DateTime.UtcNow);
    }

    /// <summary>Edita nome, ícone, alvo e prazo (só quem criou). A caixinha acompanha o nome.</summary>
    public async Task<MetaDto> AtualizarAsync(Guid metaId, CriarMetaDto dto, Guid usuarioId)
    {
        var meta = await BuscarPropriaAsync(metaId, usuarioId);
        if (dto.CategoriaId.HasValue)
            await DonoRecursos.ExigirCategoriaAsync(_context, dto.CategoriaId.Value, usuarioId);
        var prazo = NormalizarPrazo(dto.DataLimite, permitirPassado: true);
        if (prazo.HasValue && prazo != meta.DataLimite && prazo.Value < InicioDoMes(DateTime.UtcNow))
            throw new ArgumentException("O prazo não pode ser num mês que já passou.");

        meta.Nome = ValidarNome(dto.Nome);
        meta.Descricao = string.IsNullOrWhiteSpace(dto.Descricao) ? null : dto.Descricao.Trim();
        meta.Icone = ValidarIcone(dto.Icone ?? meta.Icone);
        meta.ValorAlvo = dto.ValorAlvo;
        meta.DataLimite = prazo;
        meta.CategoriaId = dto.CategoriaId;
        meta.AtualizadoEm = DateTime.UtcNow;
        if (meta.ContaId.HasValue && await _context.Contas.FindAsync(meta.ContaId.Value) is { } caixinha)
            caixinha.Nome = meta.Nome;
        await _context.SaveChangesAsync();
        return await ObterAsync(metaId, usuarioId);
    }

    /// <summary>Exclui a meta (soft delete) e encerra a caixinha. Com dinheiro guardado, recusa: resgate antes.</summary>
    public async Task ExcluirAsync(Guid metaId, Guid usuarioId)
    {
        var meta = await BuscarPropriaAsync(metaId, usuarioId);
        if (meta.ContaId.HasValue)
        {
            var saldo = (await RegrasFinanceiras.SaldoDaContaAsync(_context, meta.ContaId.Value, usuarioId)).Saldo;
            if (saldo != 0m)
                throw new InvalidOperationException($"A meta ainda tem {saldo:C} guardado. Resgate pra uma conta antes de excluir.");
            if (await _context.Contas.FindAsync(meta.ContaId.Value) is { } caixinha)
                caixinha.EncerradaEm = DateTime.UtcNow;
        }
        meta.Ativo = false;
        meta.AtualizadoEm = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }

    // ── Ler ──────────────────────────────────────────────────────────────────

    /// <summary>Metas ativas: as pessoais e as das famílias da pessoa; <paramref name="soPessoais"/> tira as de família.</summary>
    public async Task<List<MetaDto>> ListarAsync(Guid usuarioId, bool soPessoais = false, DateTime? agora = null)
    {
        var familiaIds = soPessoais ? [] : await _context.MembrosFamilia
            .Where(m => m.UsuarioId == usuarioId && m.Ativo)
            .Select(m => m.FamiliaId)
            .ToListAsync();
        var metas = await _context.Metas
            .Where(m => m.Ativo && (soPessoais
                ? m.UsuarioId == usuarioId && m.FamiliaId == null
                : m.UsuarioId == usuarioId || (m.FamiliaId != null && familiaIds.Contains(m.FamiliaId.Value))))
            .OrderBy(m => m.CriadoEm)
            .ToListAsync();
        var guardado = await GuardadoAsync(metas);
        var hoje = agora ?? DateTime.UtcNow;
        return metas.Select(m => Montar(m, guardado.GetValueOrDefault(m.Id), hoje)).ToList();
    }

    public async Task<MetaDto> ObterAsync(Guid metaId, Guid usuarioId, DateTime? agora = null)
    {
        var meta = await BuscarComAcessoAsync(metaId, usuarioId);
        var guardado = await GuardadoAsync([meta]);
        return Montar(meta, guardado.GetValueOrDefault(meta.Id), agora ?? DateTime.UtcNow);
    }

    /// <summary>Guardou e resgatou, do mais recente pro mais antigo (as transferências da caixinha).</summary>
    public async Task<List<MetaHistoricoDto>> HistoricoAsync(Guid metaId, Guid usuarioId)
    {
        var meta = await BuscarComAcessoAsync(metaId, usuarioId);
        if (!meta.ContaId.HasValue) return [];
        var caixinha = meta.ContaId.Value;
        // Mais recente em cima; no mesmo dia, pela hora em que foi feito (a perna de saída carrega o CriadoEm).
        return await (
                from t in _context.Transferencias.AsNoTracking()
                join perna in _context.Transacoes on t.TransacaoOrigemId equals perna.Id
                where perna.Ativo && (t.ContaDestinoId == caixinha || t.ContaOrigemId == caixinha)
                orderby t.Data descending, perna.CriadoEm descending
                select t.ContaDestinoId == caixinha
                    ? new MetaHistoricoDto(t.Id, t.Data, "guardou", t.ContaOrigemId, t.ContaOrigem!.Nome, t.Valor)
                    : new MetaHistoricoDto(t.Id, t.Data, "resgatou", t.ContaDestinoId, t.ContaDestino!.Nome, t.Valor))
            .ToListAsync();
    }

    /// <summary>Meta de cada caixinha (pra Bancos levar da conta-caixinha pra página da meta).</summary>
    public async Task<Dictionary<Guid, Guid>> MetaPorCaixinhaAsync(IEnumerable<Guid> contaIds)
    {
        var ids = contaIds.ToList();
        return await _context.Metas
            .Where(m => m.ContaId != null && ids.Contains(m.ContaId.Value))
            .ToDictionaryAsync(m => m.ContaId!.Value, m => m.Id);
    }

    // ── Guardar / resgatar ───────────────────────────────────────────────────

    /// <summary>Transfere <c>Valor</c> da conta da pessoa pra caixinha da meta. Não passa do saldo da conta.</summary>
    public async Task<MetaDto> GuardarAsync(Guid metaId, MovimentoMetaDto dto, Guid usuarioId, string? idempotencyKey)
    {
        var chave = ExigirChave(idempotencyKey);
        var meta = await BuscarPropriaAsync(metaId, usuarioId);
        var caixinha = await GarantirCaixinhaAsync(meta, usuarioId);
        var transf = Transferencia(dto.ContaId, caixinha, dto, $"Guardado em {meta.Nome}");
        await using var tx = await TransacaoTravadaAsync(metaId);
        if (!await JaFeitoAsync(usuarioId, chave))
        {
            ExigirNaoConcluida(meta);
            if (dto.ContaId == caixinha)
                throw new ArgumentException("Escolha uma conta sua, não a própria caixinha.");
            await ExigirNaoCaixinhaAsync(dto.ContaId);
            await DonoRecursos.ExigirContaAbertaAsync(_context, dto.ContaId, usuarioId);
            var saldo = (await RegrasFinanceiras.SaldoDaContaAsync(_context, dto.ContaId, usuarioId)).Saldo;
            if (dto.Valor > saldo)
                throw new InvalidOperationException(saldo > 0 ? $"Só tem {saldo:C} nessa conta." : "Essa conta está sem saldo pra guardar.");
        }
        using (_context.LiberarCaixinha())
            await _transferencias.CriarAsync(transf, usuarioId, chave);
        if (tx is not null) await tx.CommitAsync();
        return await ObterAsync(metaId, usuarioId);
    }

    /// <summary>Transfere <c>Valor</c> da caixinha de volta pra uma conta da pessoa. Não passa do guardado.</summary>
    public async Task<MetaDto> ResgatarAsync(Guid metaId, MovimentoMetaDto dto, Guid usuarioId, string? idempotencyKey)
    {
        var chave = ExigirChave(idempotencyKey);
        var meta = await BuscarPropriaAsync(metaId, usuarioId);
        var caixinha = await GarantirCaixinhaAsync(meta, usuarioId);
        var transf = Transferencia(caixinha, dto.ContaId, dto, $"Resgatado de {meta.Nome}");
        await using var tx = await TransacaoTravadaAsync(metaId);
        if (!await JaFeitoAsync(usuarioId, chave))
        {
            ExigirNaoConcluida(meta);
            if (dto.ContaId == caixinha)
                throw new ArgumentException("Escolha pra qual conta sua o dinheiro volta.");
            await ExigirNaoCaixinhaAsync(dto.ContaId);
            await DonoRecursos.ExigirContaAbertaAsync(_context, dto.ContaId, usuarioId);
            var guardado = (await RegrasFinanceiras.SaldoDaContaAsync(_context, caixinha, usuarioId)).Saldo;
            if (dto.Valor > guardado)
                throw new InvalidOperationException(guardado > 0 ? $"A meta só tem {guardado:C} guardado." : "A meta ainda não tem nada guardado.");
        }
        using (_context.LiberarCaixinha())
            await _transferencias.CriarAsync(transf, usuarioId, chave);
        if (tx is not null) await tx.CommitAsync();
        return await ObterAsync(metaId, usuarioId);
    }

    /// <summary>
    /// "Concluir e usar o dinheiro": a meta que chegou lá (guardado ≥ alvo) manda o guardado TODO pra uma conta
    /// da pessoa (uma transferência), grava quando concluiu e quanto juntou e encerra a caixinha, tudo numa
    /// transação. A meta fica em Concluídas com o histórico. Idempotency-Key obrigatória (repetir devolve a meta).
    /// </summary>
    public async Task<MetaDto> ConcluirAsync(Guid metaId, ConcluirMetaDto dto, Guid usuarioId, string? idempotencyKey)
    {
        var chave = ExigirChave(idempotencyKey);
        var meta = await BuscarPropriaAsync(metaId, usuarioId);
        var caixinha = await GarantirCaixinhaAsync(meta, usuarioId);
        await using var tx = await TransacaoTravadaAsync(metaId);
        await _context.Entry(meta).ReloadAsync(); // outra aba pode ter concluído enquanto esta esperava a trava
        if (await JaFeitoAsync(usuarioId, chave))
        {
            if (meta.ConcluidaEm is not null) return await ObterAsync(metaId, usuarioId); // repetição
            throw new InvalidOperationException(Idempotencia.MensagemChaveComOutrosDados);
        }
        if (meta.ConcluidaEm is not null)
            throw new InvalidOperationException("Essa meta já foi concluída.");
        if (dto.ContaId == caixinha)
            throw new ArgumentException("Escolha pra qual conta sua o dinheiro vai.");
        await ExigirNaoCaixinhaAsync(dto.ContaId);
        await DonoRecursos.ExigirContaAbertaAsync(_context, dto.ContaId, usuarioId);
        var guardado = (await RegrasFinanceiras.SaldoDaContaAsync(_context, caixinha, usuarioId)).Saldo;
        if (guardado < meta.ValorAlvo)
            throw new InvalidOperationException($"A meta ainda não chegou lá: faltam {meta.ValorAlvo - guardado:C}. Pra usar uma parte, resgate.");

        // O dia é o do aparelho da pessoa (a tela manda), o mesmo da transferência: UtcNow virava o dia seguinte
        // depois das 21h em Brasília.
        var dia = dto.Data ?? DateOnly.FromDateTime(DateTime.UtcNow);
        using (_context.LiberarCaixinha())
            await _transferencias.CriarAsync(new CriarTransferenciaDto
            {
                ContaOrigemId = caixinha,
                ContaDestinoId = dto.ContaId,
                Valor = guardado,
                Data = dia,
                Descricao = $"Meta concluída: {meta.Nome}",
            }, usuarioId, chave);
        meta.ConcluidaEm = dia.ToDateTime(TimeOnly.MinValue);
        meta.ValorJuntado = guardado;
        meta.AtualizadoEm = DateTime.UtcNow;
        if (await _context.Contas.FindAsync(caixinha) is { } conta)
            conta.EncerradaEm = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        if (tx is not null) await tx.CommitAsync();
        return await ObterAsync(metaId, usuarioId);
    }

    /// <summary>Desfaz a conclusão: a meta volta pra Em andamento com a caixinha (vazia) aberta de novo.</summary>
    public async Task<MetaDto> ReabrirAsync(Guid metaId, Guid usuarioId)
    {
        var meta = await BuscarPropriaAsync(metaId, usuarioId);
        if (meta.ConcluidaEm is null)
            throw new InvalidOperationException("Essa meta não está concluída.");
        meta.ConcluidaEm = null;
        meta.ValorJuntado = null;
        meta.AtualizadoEm = DateTime.UtcNow;
        if (meta.ContaId.HasValue && await _context.Contas.FindAsync(meta.ContaId.Value) is { } caixinha)
            caixinha.EncerradaEm = null;
        await _context.SaveChangesAsync();
        return await ObterAsync(metaId, usuarioId);
    }

    // ── Cálculo (estático: testável sem banco) ──────────────────────────────

    /// <summary>Meses até o prazo contando o mês atual (set/2026 → dez/2027 = 16). Null sem prazo.</summary>
    public static int? MesesAte(DateTime? prazo, DateTime hoje) =>
        prazo is null ? null : (prazo.Value.Year - hoje.Year) * 12 + (prazo.Value.Month - hoje.Month) + 1;

    public static (string Situacao, int? Meses, decimal? PorMes) Situacao(decimal alvo, decimal guardado, DateTime? prazo, DateTime criadaEm, DateTime hoje)
    {
        if (guardado >= alvo) return ("concluida", null, null);
        if (prazo is null) return ("sem-prazo", null, null);
        var meses = MesesAte(prazo, hoje)!.Value;
        if (meses < 1) return ("prazo-passou", 0, null);
        var porMes = Math.Ceiling((alvo - guardado) / meses * 100m) / 100m;
        // No ritmo = já guardou pelo menos o que guardaria se fosse igual todo mês desde que criou.
        var total = Math.Max(1, MesesAte(prazo, criadaEm)!.Value);
        var decorridos = Math.Clamp(total - meses, 0, total);
        var esperado = alvo * decorridos / total;
        return (guardado >= esperado ? "no-ritmo" : "atras", meses, porMes);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static MetaDto Montar(Meta m, decimal guardado, DateTime hoje)
    {
        // Concluída (o dinheiro já foi usado): o progresso é o que juntou, não o que sobrou na caixinha.
        var concluidaDeVez = m.ConcluidaEm is not null;
        var progresso = concluidaDeVez ? m.ValorJuntado ?? 0m : guardado;
        var (situacao, meses, porMes) = concluidaDeVez ? ("concluida", (int?)null, (decimal?)null)
            : Situacao(m.ValorAlvo, guardado, m.DataLimite, m.CriadoEm, hoje);
        var pct = m.ValorAlvo > 0 ? Math.Clamp(Math.Round(progresso * 100m / m.ValorAlvo, 2), 0m, 100m) : 0m;
        return new MetaDto(
            m.Id, m.Nome, m.Descricao, m.Icone ?? "alvo", m.ValorAlvo, guardado,
            concluidaDeVez ? 0m : Math.Max(0m, m.ValorAlvo - guardado), pct,
            concluidaDeVez || guardado >= m.ValorAlvo, m.DataLimite, meses, porMes, situacao, m.ContaId,
            m.UsuarioId, m.FamiliaId, m.CategoriaId, m.Ativo, m.CriadoEm, m.AtualizadoEm, m.ConcluidaEm, m.ValorJuntado);
    }

    /// <summary>Saldo de cada caixinha, pela regra única de saldo (dono da caixinha = dono da meta).</summary>
    private async Task<Dictionary<Guid, decimal>> GuardadoAsync(List<Meta> metas)
    {
        var resultado = new Dictionary<Guid, decimal>();
        foreach (var dono in metas.Where(m => m.ContaId.HasValue).GroupBy(m => m.UsuarioId))
        {
            var saldos = await RegrasFinanceiras.SaldosDasContasAsync(_context, dono.Select(m => m.ContaId!.Value), dono.Key);
            foreach (var m in dono)
                resultado[m.Id] = saldos[m.ContaId!.Value].Saldo;
        }
        return resultado;
    }

    private Conta NovaCaixinha(string nome, Guid usuarioId)
    {
        var conta = new Conta { Id = Guid.NewGuid(), Nome = nome, Tipo = TipoConta.Caixinha, UsuarioIdProprietario = usuarioId };
        _context.Contas.Add(conta);
        return conta;
    }

    /// <summary>Meta antiga (de antes das caixinhas) ganha a dela no primeiro guardar/resgatar.</summary>
    private async Task<Guid> GarantirCaixinhaAsync(Meta meta, Guid usuarioId)
    {
        if (meta.ContaId.HasValue) return meta.ContaId.Value;
        meta.ContaId = NovaCaixinha(meta.Nome, usuarioId).Id;
        await _context.SaveChangesAsync();
        return meta.ContaId.Value;
    }

    private static CriarTransferenciaDto Transferencia(Guid origem, Guid destino, MovimentoMetaDto dto, string descricao) => new()
    {
        ContaOrigemId = origem,
        ContaDestinoId = destino,
        Valor = dto.Valor,
        Data = dto.Data ?? DateOnly.FromDateTime(DateTime.UtcNow),
        Descricao = descricao,
    };

    private static void ExigirNaoConcluida(Meta meta)
    {
        if (meta.ConcluidaEm is not null)
            throw new InvalidOperationException("Essa meta já foi concluída. Reabra pra mexer nela de novo.");
    }

    /// <summary>
    /// Transação com a linha da meta travada (Postgres, <c>FOR UPDATE</c>): guardar, resgatar e concluir da MESMA
    /// meta passam um de cada vez. Sem isso, dois resgates ao mesmo tempo (chaves diferentes) liam o mesmo
    /// guardado e deixavam a caixinha negativa. Já dentro de uma transação (ou fora do Postgres): nada a abrir.
    /// </summary>
    private async Task<Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction?> TransacaoTravadaAsync(Guid metaId)
    {
        if (_context.Database.CurrentTransaction is not null || !_context.Database.IsRelational()) return null;
        var tx = await _context.Database.BeginTransactionAsync();
        await _context.Database.ExecuteSqlInterpolatedAsync($"SELECT 1 FROM \"Metas\" WHERE \"Id\" = {metaId} FOR UPDATE");
        return tx;
    }

    private async Task ExigirNaoCaixinhaAsync(Guid contaId)
    {
        if (await _context.Contas.AnyAsync(c => c.Id == contaId && c.Tipo == TipoConta.Caixinha))
            throw new ArgumentException("Escolha uma conta sua, não a caixinha de outra meta.");
    }

    private static string ExigirChave(string? chave)
    {
        if (string.IsNullOrWhiteSpace(chave))
            throw new ArgumentException("O header Idempotency-Key é obrigatório.");
        Idempotencia.ExigirTamanho(chave);
        return chave;
    }

    /// <summary>A chave já moveu dinheiro? (aí a transferência devolve a original ou 409, sem checar saldo de novo).</summary>
    private async Task<bool> JaFeitoAsync(Guid usuarioId, string chave) =>
        await Idempotencia.BuscarAsync(_context, usuarioId, TransferenciaService.OperacaoCriarTransferencia, chave) is not null;

    private static string ValidarNome(string nome)
    {
        nome = (nome ?? string.Empty).Trim();
        if (nome.Length == 0) throw new ArgumentException("Dê um nome pra meta.");
        if (nome.Length > 100) throw new ArgumentException("O nome pode ter no máximo 100 caracteres.");
        return nome;
    }

    private static string ValidarIcone(string? icone)
    {
        if (string.IsNullOrWhiteSpace(icone)) return "alvo";
        if (!Icones.Contains(icone)) throw new ArgumentException("Ícone inválido.");
        return icone;
    }

    private static DateTime InicioDoMes(DateTime d) => new(d.Year, d.Month, 1);

    /// <summary>Prazo é um MÊS: guarda o dia 1 dele. Não aceita mês que já passou (na criação).</summary>
    private static DateTime? NormalizarPrazo(DateTime? prazo, bool permitirPassado)
    {
        if (prazo is null) return null;
        var mes = InicioDoMes(prazo.Value);
        if (!permitirPassado && mes < InicioDoMes(DateTime.UtcNow))
            throw new ArgumentException("O prazo não pode ser num mês que já passou.");
        if (mes.Year > DateTime.UtcNow.Year + 60)
            throw new ArgumentException("Prazo longe demais.");
        return mes;
    }

    /// <summary>Meta que a pessoa pode MEXER (só quem criou). Quem nem vê → 404, igual "não existe" (não confirma
    /// que o id existe); quem vê pela família mas não criou → 403.</summary>
    private async Task<Meta> BuscarPropriaAsync(Guid metaId, Guid usuarioId)
    {
        var meta = await BuscarComAcessoAsync(metaId, usuarioId);
        if (meta.UsuarioId != usuarioId)
            throw new ForbiddenAccessException("Você não tem permissão para mexer nesta meta.");
        return meta;
    }

    private async Task<Meta> BuscarComAcessoAsync(Guid metaId, Guid usuarioId)
    {
        var meta = await _context.Metas.FirstOrDefaultAsync(m => m.Id == metaId && m.Ativo)
            ?? throw new KeyNotFoundException("Meta não encontrada.");
        if (meta.UsuarioId == usuarioId)
            return meta;
        if (meta.FamiliaId.HasValue && await _context.MembrosFamilia
                .AnyAsync(m => m.FamiliaId == meta.FamiliaId && m.UsuarioId == usuarioId && m.Ativo))
            return meta;
        throw new KeyNotFoundException("Meta não encontrada.");
    }

    private async Task ExigirMembroAsync(Guid familiaId, Guid usuarioId)
    {
        if (!await _context.MembrosFamilia.AnyAsync(m => m.FamiliaId == familiaId && m.UsuarioId == usuarioId && m.Ativo))
            throw new KeyNotFoundException("Família não encontrada ou sem permissão.");
    }
}
