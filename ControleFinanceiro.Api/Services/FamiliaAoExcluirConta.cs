using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Passo 7 do espaço da família (docs/features/familia/espaco-da-familia.md §4.6; decisão do Gustavo 2026-10-19): quem
/// EXCLUI A CONTA sai da família sem travar a purga (antes o vínculo de família bloqueava a exclusão pra sempre, contra
/// o direito de eliminação, LGPD Art. 18). A família guarda SÓ OS NÚMEROS das despesas que a pessoa dividiu (valor,
/// data, categoria padrão, a parte de cada um) e o dinheiro que passou entre eles, em nome de um "Membro que saiu"
/// (<see cref="StatusUsuario.Removido"/>): sem nome, e-mail, foto, descrição, conta, cartão nem categoria própria.
/// Base: interesse legítimo dos outros membros no próprio histórico financeiro (Art. 7º, IX), com minimização (Art. 6º,
/// III). Não é anônimo pra quem conhece a pessoa, então é dado pessoal mínimo, não "dado anonimizado" (Art. 12);
/// registrado em docs/CONFORMIDADE_BR.md. Roda dentro da transação da purga, antes de apagar o resto.
/// </summary>
public static class FamiliaAoExcluirConta
{
    public const string NomeMembroQueSaiu = "Membro que saiu";

    /// <summary>Desfaz os vínculos de família da pessoa. Devolve o id do "Membro que saiu" criado (null = não tinha
    /// vínculo nenhum). Não salva: quem chama salva na mesma transação.</summary>
    public static async Task<Guid?> DesvincularAsync(AppDbContext ctx, Guid usuarioId)
    {
        var membros = await ctx.MembrosFamilia.Where(m => m.UsuarioId == usuarioId).ToListAsync();
        var criadas = await ctx.Familias.Where(f => f.CriadoPorUsuarioId == usuarioId).ToListAsync();
        var convites = await ctx.ConvitesFamilia.Where(c => c.CriadoPorUsuarioId == usuarioId).ToListAsync();
        var partes = await ctx.RateiosTransacao.Where(r => r.UsuarioId == usuarioId).ToListAsync();
        var acertos = await ctx.AcertosContas
            .Where(a => a.DeUsuarioId == usuarioId || a.ParaUsuarioId == usuarioId || a.CriadoPor == usuarioId).ToListAsync();
        var divididas = await ctx.Transacoes.IgnoreQueryFilters()
            .Where(t => t.CriadoPor == usuarioId && t.FamiliaId != null && t.Ativo && t.StatusTransacao == StatusTransacao.Executado)
            .ToListAsync();
        if (membros.Count == 0 && criadas.Count == 0 && convites.Count == 0 && partes.Count == 0 && acertos.Count == 0 && divididas.Count == 0)
            return null;

        // Quem fica no lugar: um usuário que não loga e não aparece em lugar nenhum além do histórico da família.
        var anonimo = new Usuario
        {
            Id = Guid.NewGuid(),
            Nome = NomeMembroQueSaiu,
            Email = $"removido-{Guid.NewGuid():N}@removido.invalid",
            PasswordHash = string.Empty,
            Status = StatusUsuario.Removido,
        };
        ctx.Usuarios.Add(anonimo);
        var agora = DateTime.UtcNow;

        // As despesas que a pessoa dividiu e que aconteceram: só os números ficam, em nome do "Membro que saiu".
        var categoriasPadrao = await ctx.Categorias.Where(c => c.UsuarioId == null).ToDictionaryAsync(c => c.Id, c => c.Descricao);
        foreach (var t in divididas)
        {
            var padrao = t.CategoriaId is { } cid && categoriasPadrao.ContainsKey(cid);
            t.CriadoPor = anonimo.Id;
            t.Descricao = padrao ? categoriasPadrao[t.CategoriaId!.Value] : "Despesa da casa";
            if (!padrao) t.CategoriaId = null; // categoria própria some com a conta
            t.SubcategoriaId = null;
            t.ContaId = null;
            t.CartaoCreditoId = null;
            t.FaturaId = null;
            t.UsadoComoCredito = false;
            t.MeioPagamento = null;
            t.Hora = null;
            t.RecorrenteOrigemId = null;
            t.ImportacaoFitId = null;
            if (t.ResponsavelUsuarioId == usuarioId) t.ResponsavelUsuarioId = null;
        }

        foreach (var r in partes) r.UsuarioId = anonimo.Id;

        // Dinheiro entre vocês: os valores ficam; a nota (texto livre) não. Os lançamentos da pessoa saem com a conta.
        foreach (var a in acertos)
        {
            if (a.DeUsuarioId == usuarioId) a.DeUsuarioId = anonimo.Id;
            if (a.ParaUsuarioId == usuarioId) a.ParaUsuarioId = anonimo.Id;
            if (a.CriadoPor == usuarioId) a.CriadoPor = anonimo.Id;
            a.Observacao = null;
        }

        // Despesas dos outros que apontavam a pessoa como responsável ou aprovadora: o campo fica vazio.
        foreach (var t in await ctx.Transacoes.IgnoreQueryFilters()
                     .Where(t => t.CriadoPor != usuarioId && (t.ResponsavelUsuarioId == usuarioId || t.AprovadoPorUsuarioId == usuarioId))
                     .ToListAsync())
        {
            if (t.ResponsavelUsuarioId == usuarioId) t.ResponsavelUsuarioId = null;
            if (t.AprovadoPorUsuarioId == usuarioId) t.AprovadoPorUsuarioId = null;
        }

        // A ficha na família vira "Membro que saiu" (com a data), sem nada do que a pessoa escolheu.
        foreach (var m in membros)
        {
            m.UsuarioId = anonimo.Id;
            m.Ativo = false;
            m.SaiuEm ??= agora;
            m.Papel = string.Empty;
            m.VisibilidadeRenda = VisibilidadeRenda.Nada;
            m.RendaVisivelPara = new();
        }
        // Ninguém mais "libera a renda" pra quem não existe (só nas famílias em que a pessoa estava).
        var familiasDela = membros.Select(m => m.FamiliaId).Distinct().ToList();
        foreach (var m in await ctx.MembrosFamilia.Where(m => familiasDela.Contains(m.FamiliaId) && m.UsuarioId != usuarioId).ToListAsync())
            if (m.RendaVisivelPara.Remove(usuarioId)) m.RendaVisivelPara = new(m.RendaVisivelPara);

        // Família que a pessoa criou passa pro membro mais antigo que lança (vira admin); sem ninguém, é dissolvida.
        foreach (var f in criadas)
        {
            var herdeiro = await ctx.MembrosFamilia
                .Where(m => m.FamiliaId == f.Id && m.Ativo && m.UsuarioId != usuarioId && m.UsuarioId != anonimo.Id
                            && m.PapelPermissao != PapelFamilia.Dependente)
                .OrderBy(m => m.EntrouEm)
                .FirstOrDefaultAsync();
            if (herdeiro is null)
            {
                f.CriadoPorUsuarioId = anonimo.Id;
                f.Ativa = false;
            }
            else
            {
                f.CriadoPorUsuarioId = herdeiro.UsuarioId;
                herdeiro.PapelPermissao = PapelFamilia.Admin;
            }
        }

        ctx.ConvitesFamilia.RemoveRange(convites);
        return anonimo.Id;
    }
}
