using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.DinheiroDoMes;
using ControleFinanceiro.Api.DTOs.Relatorios;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// "O que vale olhar" de Relatórios (plano em docs/features/relatorios/plano.md §2.3): os avisos que as outras telas já
/// dão, juntos numa lista. SÓ AGREGA: cada frase vem do serviço que já responde ali (limite: <see cref="OrcamentoService"/>;
/// metas: <see cref="ViabilidadeMetaService"/>; empréstimos: <see cref="ProximosEmprestimosService"/>; orçamento:
/// <see cref="OrcamentoDoMesService"/>; faturas: <see cref="RegrasFinanceiras.FaturasAPagarNoMesAsync"/>; conta fixa sem
/// limite: a notificação do job). Nenhuma regra nova aqui. Ordem: tom (alerta, negativo, neutro, positivo) e, dentro
/// dele, o valor em jogo. O que é "de hoje" (metas, empréstimos, cobrança sem limite) só no mês atual.
/// Os avisos de "Seus dados" (sem categoria, renda, conta fixa) vêm no próprio check-up.
/// </summary>
public class SinaisDoMesService
{
    private const int MaxLimites = 3;

    private readonly AppDbContext _context;
    private readonly OrcamentoService _orcamentos;
    private readonly OrcamentoDoMesService _orcamentoDoMes;
    private readonly ViabilidadeMetaService _viabilidade;
    private readonly ProximosEmprestimosService _emprestimos;

    public SinaisDoMesService(AppDbContext context, OrcamentoService orcamentos, OrcamentoDoMesService orcamentoDoMes,
        ViabilidadeMetaService viabilidade, ProximosEmprestimosService emprestimos)
    {
        _context = context;
        _orcamentos = orcamentos;
        _orcamentoDoMes = orcamentoDoMes;
        _viabilidade = viabilidade;
        _emprestimos = emprestimos;
    }

    public async Task<List<SinalDto>> CalcularAsync(Guid usuarioId, int ano, int mes)
    {
        if (mes is < 1 or > 12 || ano is < 2000 or > 2100)
            throw new ArgumentException("Mês inválido.");
        var hoje = HorarioBrasil.HojeData();
        var mesAtual = ano == hoje.Year && mes == hoje.Month;
        var sinais = new List<SinalDto>();

        // Limite: categoria que passou ou vai passar do planejado (a frase é a do Orçamento, envelopada).
        var limites = (await _orcamentos.DoMesAsync(usuarioId, ano, mes)).Limites
            .Where(l => l.Situacao is "passou" or "vai-passar" && !string.IsNullOrWhiteSpace(l.Resposta))
            .OrderByDescending(l => l.Situacao == "passou").ThenByDescending(l => l.Gasto + l.Previsto - l.Limite).ToList();
        foreach (var l in limites.Take(MaxLimites))
            sinais.Add(new SinalDto($"limite-{l.CategoriaId}-{ano}-{mes}", "limite", Math.Max(0m, l.Gasto + l.Previsto - l.Limite), false,
                new RespostaDto(l.Situacao == "passou" ? "negativo" : "alerta", $"{l.Categoria}: {l.Resposta}", [new AcaoDto("Ver o planejado", "/orcamento")])));
        if (limites.Count > MaxLimites)
            sinais.Add(new SinalDto($"limites-mais-{ano}-{mes}", "limite", 0m, false, new RespostaDto("alerta",
                $"E mais {limites.Count - MaxLimites} {(limites.Count - MaxLimites == 1 ? "categoria passando" : "categorias passando")} do planejado.",
                [new AcaoDto("Ver o planejado", "/orcamento")])));

        // Orçamento: a renda planejada não cobre o que foi planejado ("a ser alocado" negativo).
        var orcamento = await _orcamentoDoMes.CalcularAsync(usuarioId, ano, mes);
        if (orcamento.AAlocar < 0)
            sinais.Add(new SinalDto($"a-alocar-{ano}-{mes}", "orcamento", -orcamento.AAlocar, false,
                orcamento.Resposta with { Acoes = orcamento.Resposta.Acoes.Count > 0 ? orcamento.Resposta.Acoes : [new AcaoDto("Ver o orçamento", "/orcamento")] }));

        // Fatura que venceu e ficou sem pagar.
        foreach (var f in (await RegrasFinanceiras.FaturasAPagarNoMesAsync(_context, usuarioId, ano, mes)).Where(f => f.Atrasada))
            sinais.Add(new SinalDto($"fatura-{f.FaturaId}", "fatura", f.Restante, false, new RespostaDto("alerta",
                $"Fatura do {f.Cartao} atrasada: {Reais.Formatar(f.Restante)} desde {f.DataVencimento:dd/MM}.", [new AcaoDto("Ver cartões", "/cartoes")])));

        if (mesAtual)
        {
            // Metas: só quando juntas não cabem (a frase é a da lista de Metas).
            var metas = await _viabilidade.DasMetasAsync(usuarioId);
            if (metas.Resposta is { } rm && metas.PedemPorMes > 0 && (metas.Folga is null || metas.PedemPorMes > metas.Folga))
                sinais.Add(new SinalDto("metas-nao-cabem", "metas", metas.PedemPorMes - (metas.Folga ?? 0m), true,
                    rm with { Acoes = rm.Acoes.Count > 0 ? rm.Acoes : [new AcaoDto("Ver metas", "/metas")] }));

            // Empréstimo: o que vence em 30 dias e o saldo de hoje não cobre.
            var emprestimos = await _emprestimos.CalcularAsync(usuarioId, DateOnly.FromDateTime(hoje));
            var devolver = emprestimos.Devolver.Sum(d => d.Valor);
            if (emprestimos.Resposta is { } re && devolver > emprestimos.SaldoNasContas)
                sinais.Add(new SinalDto("emprestimos-30-dias", "emprestimo", devolver - emprestimos.SaldoNasContas, true,
                    re with { Acoes = re.Acoes.Count > 0 ? re.Acoes : [new AcaoDto("Ver empréstimos", "/emprestimos")] }));

            // Conta fixa no cartão que não foi cobrada por falta de limite (o aviso do job, uma vez por cobrança).
            var inicio = new DateTime(ano, mes, 1);
            var semLimite = await _context.Notificacoes.AsNoTracking()
                .Where(n => n.UsuarioId == usuarioId && n.Tipo == TipoNotificacao.CobrancaSemLimite && n.CriadoEm >= inicio)
                .OrderByDescending(n => n.CriadoEm).Select(n => n.Mensagem).ToListAsync();
            if (semLimite.Count > 0)
                sinais.Add(new SinalDto($"cobranca-sem-limite-{ano}-{mes}", "conta-fixa", 0m, true, new RespostaDto("alerta",
                    semLimite.Count == 1 ? semLimite[0] : $"{semLimite.Count} contas fixas no cartão não foram cobradas por falta de limite.",
                    [new AcaoDto("Ver contas fixas", "/contas-fixas")])));
        }

        static int OrdemDoTom(string tom) => tom switch { "alerta" => 0, "negativo" => 1, "neutro" => 2, _ => 3 };
        return sinais.OrderBy(s => OrdemDoTom(s.Resposta.Tom)).ThenByDescending(s => s.Peso).ToList();
    }
}
