using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Familia;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

public class RateioService
{
    private readonly AppDbContext _context;

    public RateioService(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>Define o modo de rateio padrão da família. Vale pras PRÓXIMAS despesas: as já divididas ficam com as
    /// partes gravadas (<see cref="RateioTransacao"/>).</summary>
    public async Task DefinirModoFamiliaAsync(Guid familiaId, Guid usuarioId, ModoRateio modo)
    {
        // 2.3 — modo de rateio é config da família: só Admin.
        await FamiliaPermissoes.ExigirPapelAsync(_context, familiaId, usuarioId, PapelFamilia.Admin);

        var familia = await _context.Familias
            .FirstOrDefaultAsync(f => f.Id == familiaId && f.Ativa)
            ?? throw new KeyNotFoundException("Família não encontrada.");

        familia.ModoRateioPadrao = modo;

        // As cobranças PREVISTAS das contas fixas da casa ainda não aconteceram: seguem a regra nova (o que já
        // aconteceu fica como está). A que a pessoa dividiu "do meu jeito" fica como ela deixou.
        var previstas = await _context.Transacoes
            .Include(t => t.Rateios)
            .Where(t => t.FamiliaId == familiaId && t.Ativo && t.StatusTransacao == StatusTransacao.Previsao
                        && t.RecorrenteOrigemId != null && t.ModoRateio != ModoRateio.Personalizado)
            .ToListAsync();
        foreach (var t in previstas)
            await AplicarPartesAsync(t, familiaId, ModoAoDividir(modo), null);
        await _context.SaveChangesAsync();
    }

    /// <summary>
    /// A parte de cada um numa despesa, calculada AGORA e devolvida pra gravar (regra única: dividir, mudar o jeito de
    /// uma despesa, voltar ao padrão). Quem entra: os membros ativos que não são "só vê". Igual: partes iguais. Pela
    /// renda: peso = renda prevista de cada um no MÊS DA DESPESA (<see cref="RendaService.PesosAsync"/>); sem peso
    /// nenhum, igual. Do meu jeito: as partes informadas. Em reais, com o resto dos centavos em quem pagou.
    /// </summary>
    public async Task<List<RateioTransacao>> CalcularPartesAsync(Guid familiaId, Transacao transacao, ModoRateio modo, List<RateioItemDto>? itens)
    {
        List<(Guid UsuarioId, decimal Percentual)> partes;
        if (modo == ModoRateio.Personalizado)
        {
            var lista = itens ?? throw new ArgumentException("O modo Do meu jeito exige a parte de cada um.");
            await ValidarItensAsync(familiaId, lista);
            partes = lista.Select(i => (i.UsuarioId, i.Percentual)).ToList();
        }
        else
        {
            var membros = await _context.MembrosFamilia
                .Where(m => m.FamiliaId == familiaId && m.Ativo && m.PapelPermissao != PapelFamilia.Dependente)
                .Select(m => m.UsuarioId)
                .OrderBy(id => id)
                .ToListAsync();
            if (membros.Count == 0)
                throw new InvalidOperationException("A família não tem ninguém pra dividir.");
            var pesos = modo == ModoRateio.Proporcional
                ? await new RendaService(_context).PesosAsync(familiaId, transacao.Data.Year, transacao.Data.Month)
                : new Dictionary<Guid, decimal>();
            var soma = membros.Sum(m => pesos.GetValueOrDefault(m));
            partes = membros
                .Select(m => (m, soma > 0 ? Math.Round(pesos.GetValueOrDefault(m) / soma * 100m, 4) : Math.Round(100m / membros.Count, 4)))
                .ToList();
        }

        var resultado = partes.Select(p => new RateioTransacao
        {
            Id = Guid.NewGuid(), TransacaoId = transacao.Id, UsuarioId = p.UsuarioId, Percentual = p.Percentual,
            Valor = Math.Round(transacao.Valor * p.Percentual / 100m, 2),
        }).ToList();
        var resto = transacao.Valor - resultado.Sum(r => r.Valor);
        if (resto != 0m && resultado.Count > 0)
            (resultado.FirstOrDefault(r => r.UsuarioId == transacao.CriadoPor) ?? resultado[0]).Valor += resto;
        return resultado;
    }

    /// <summary>Troca as partes gravadas da despesa pelas calculadas agora (a transação vem com <c>Rateios</c>). Não salva.</summary>
    /// <summary>O jeito com que uma despesa nasce dividida (ou volta ao padrão): o da família, mas "Do meu jeito" sem
    /// as partes ditas começa igual (a pessoa ajusta na página da despesa).</summary>
    public static ModoRateio ModoAoDividir(ModoRateio padraoDaFamilia) =>
        padraoDaFamilia == ModoRateio.Personalizado ? ModoRateio.Igualitario : padraoDaFamilia;

    public async Task AplicarPartesAsync(Transacao transacao, Guid familiaId, ModoRateio modo, List<RateioItemDto>? itens)
    {
        var novas = await CalcularPartesAsync(familiaId, transacao, modo, itens);
        _context.RateiosTransacao.RemoveRange(transacao.Rateios.ToList());
        transacao.Rateios.Clear();
        // Pelo DbSet (Added): posta só na navegação, com a chave já definida, o EF marca como Modified e o salvar cai.
        // O EF já encaixa cada item em transacao.Rateios (fixup); adicionar de novo duplicava.
        _context.RateiosTransacao.AddRange(novas);
        transacao.ModoRateio = modo;
    }

    /// <summary>O VALOR da despesa dividida mudou (editou o lançamento, a próxima cobrança da conta fixa): as mesmas
    /// pessoas com o mesmo % de antes, em reais pelo valor novo, com o resto dos centavos em quem pagou. Nunca
    /// recalcula pela regra de hoje (quem entrou ou saiu depois não muda a divisão). Sem partes, nada a fazer.</summary>
    public async Task RegravarPeloValorAsync(Transacao transacao)
    {
        if (transacao.FamiliaId is null) return;
        await _context.Entry(transacao).Collection(t => t.Rateios).LoadAsync();
        var partes = transacao.Rateios.OrderBy(r => r.UsuarioId).ToList();
        if (partes.Count == 0) return;
        foreach (var r in partes)
            r.Valor = Math.Round(transacao.Valor * r.Percentual / 100m, 2); // o mesmo arredondamento do CalcularPartesAsync
        var resto = transacao.Valor - partes.Sum(r => r.Valor);
        if (resto != 0)
            (partes.FirstOrDefault(r => r.UsuarioId == transacao.CriadoPor) ?? partes[0]).Valor += resto;
    }

    /// <summary>Muda o jeito de dividir SÓ desta despesa (e regrava as partes).</summary>
    public async Task DefinirRateioTransacaoAsync(
        Guid transacaoId, Guid usuarioId, DefinirRateioTransacaoDto dto)
    {
        var transacao = await _context.Transacoes
            .Include(t => t.Rateios)
            .FirstOrDefaultAsync(t => t.Id == transacaoId && t.Ativo)
            ?? throw new KeyNotFoundException("Transação não encontrada.");

        if (transacao.CriadoPor != usuarioId)
            throw new ForbiddenAccessException("Você só pode alterar suas próprias transações.");

        if (transacao.FamiliaId is not { } familiaId)
            throw new InvalidOperationException(
                "A transação precisa ser uma despesa compartilhada para definir rateio.");

        await AplicarPartesAsync(transacao, familiaId, dto.Modo, dto.Itens);
        await _context.SaveChangesAsync();
    }

    /// <summary>Volta esta despesa ao padrão da família (regrava as partes pela regra de HOJE; segue gravada).</summary>
    public async Task RemoverRateioTransacaoAsync(Guid transacaoId, Guid usuarioId)
    {
        var transacao = await _context.Transacoes
            .Include(t => t.Rateios)
            .FirstOrDefaultAsync(t => t.Id == transacaoId && t.Ativo)
            ?? throw new KeyNotFoundException("Transação não encontrada.");

        if (transacao.CriadoPor != usuarioId)
            throw new ForbiddenAccessException("Você só pode alterar suas próprias transações.");

        if (transacao.FamiliaId is not { } familiaId)
            throw new InvalidOperationException("A transação precisa ser uma despesa compartilhada.");

        var familia = await _context.Familias.FirstOrDefaultAsync(f => f.Id == familiaId && f.Ativa)
            ?? throw new KeyNotFoundException("Família não encontrada.");
        await AplicarPartesAsync(transacao, familiaId, ModoAoDividir(familia.ModoRateioPadrao), null);
        await _context.SaveChangesAsync();
    }

    /// <summary>Lê o rateio de uma despesa: o modo e a parte gravada de cada um (quem saiu da família aparece com
    /// <c>SaiuEm</c>). Quem lançou e qualquer membro da família podem ver.</summary>
    public async Task<RateioTransacaoDto> ObterRateioTransacaoAsync(Guid transacaoId, Guid usuarioId)
    {
        var transacao = await _context.Transacoes
            .Include(t => t.Rateios)
            .FirstOrDefaultAsync(t => t.Id == transacaoId && t.Ativo)
            ?? throw new KeyNotFoundException("Transação não encontrada.");

        if (transacao.CriadoPor != usuarioId)
        {
            var ehMembro = transacao.FamiliaId is { } fid
                && await _context.MembrosFamilia.AnyAsync(m => m.FamiliaId == fid && m.UsuarioId == usuarioId && m.Ativo);
            if (!ehMembro)
                throw new ForbiddenAccessException("Você só pode ver suas próprias transações.");
        }

        var membros = new List<RateioMembroDto>();
        if (transacao.FamiliaId is { } familiaId)
        {
            var membrosFamilia = await _context.MembrosFamilia
                .Where(m => m.FamiliaId == familiaId)
                .Select(m => new { m.UsuarioId, m.Usuario!.Nome, m.Ativo, m.SaiuEm, m.PapelPermissao })
                .ToListAsync();
            var partes = transacao.Rateios.ToDictionary(r => r.UsuarioId);
            // Os que entram na divisão hoje (ativos que não são "só vê") mais quem tem parte gravada (inclusive quem saiu).
            membros = membrosFamilia
                .Where(m => (m.Ativo && m.PapelPermissao != PapelFamilia.Dependente) || partes.ContainsKey(m.UsuarioId))
                .Select(m => new RateioMembroDto(m.UsuarioId, m.Nome,
                    partes.TryGetValue(m.UsuarioId, out var p) ? p.Percentual : 0m,
                    partes.TryGetValue(m.UsuarioId, out var v) ? v.Valor : 0m,
                    m.Ativo ? null : m.SaiuEm))
                .ToList();
        }

        return new RateioTransacaoDto(transacao.ModoRateio, transacao.FamiliaId, membros);
    }

    private async Task ValidarItensAsync(Guid familiaId, List<RateioItemDto> itens)
    {
        if (itens.Count == 0)
            throw new ArgumentException("Informe ao menos um item de rateio.");

        var soma = itens.Sum(i => i.Percentual);
        if (Math.Abs(soma - 100m) > 0.01m)
            throw new ArgumentException("Os percentuais de rateio devem somar 100%.");

        if (itens.Any(i => i.Percentual < 0))
            throw new ArgumentException("Percentual de rateio não pode ser negativo.");

        var usuarioIds = itens.Select(i => i.UsuarioId).ToList();
        if (usuarioIds.Count != usuarioIds.Distinct().Count())
            throw new ArgumentException("Há membros repetidos no rateio.");

        var membrosValidos = await _context.MembrosFamilia
            .Where(m => m.FamiliaId == familiaId && m.Ativo)
            .Select(m => m.UsuarioId)
            .ToListAsync();

        if (usuarioIds.Any(id => !membrosValidos.Contains(id)))
            throw new ArgumentException("O rateio inclui alguém que não é membro ativo da família.");
    }
}
