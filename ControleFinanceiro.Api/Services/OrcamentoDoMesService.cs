using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.DinheiroDoMes;
using ControleFinanceiro.Api.DTOs.Orcamento;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// O orçamento do mês ("base zero", como a planilha do Gustavo, 2026-10-21): a renda que a pessoa espera receber
/// ganha destino nas despesas planejadas (os limites por categoria, <see cref="OrcamentoService"/>) e no que as metas
/// pedem por mês pra chegar no prazo (<see cref="MetaService"/>). O que sobra é o "a ser alocado"; zerado, toda a renda
/// tem destino. Nenhuma regra nova: renda, planejado, gasto e metas vêm de onde já moram.
/// </summary>
public class OrcamentoDoMesService
{
    private readonly AppDbContext _context;
    private readonly RendaService _renda;
    private readonly OrcamentoService _orcamentos;
    private readonly MetaService _metas;

    public OrcamentoDoMesService(AppDbContext context, RendaService renda, OrcamentoService orcamentos, MetaService metas)
    {
        _context = context;
        _renda = renda;
        _orcamentos = orcamentos;
        _metas = metas;
    }

    public async Task<OrcamentoDoMesDto> CalcularAsync(Guid usuarioId, int ano, int mes)
    {
        var renda = await _renda.ObterMesAsync(usuarioId, ano, mes); // valida o mês
        var despesas = await _orcamentos.DoMesAsync(usuarioId, ano, mes);

        // As metas em andamento da própria pessoa (que já existiam no mês): o que cada uma pede no mês e o que entrou
        // na caixinha no mês (guardado menos resgatado; só as transferências, que é como se guarda).
        var inicio = new DateOnly(ano, mes, 1);
        var fim = inicio.AddMonths(1);
        var metas = (await _metas.ListarAsync(usuarioId, soPessoais: true))
            .Where(m => !m.Concluida && m.ContaId.HasValue && DateOnly.FromDateTime(HorarioBrasil.DeUtc(m.CriadoEm)) < fim)
            .ToList();
        // O pedido do mês se conta do COMEÇO do mês (guardar no mês não encolhe o pedido do próprio mês). Mês futuro
        // usa o pedido de agora: guardando o pedido todo mês, ele não muda.
        var hoje = HorarioBrasil.Hoje();
        var mesAtual = new DateOnly(hoje.Year, hoje.Month, 1);
        var referencia = inicio < mesAtual ? inicio : mesAtual;
        var desde = referencia < inicio ? referencia : inicio;
        var caixinhas = metas.Select(m => m.ContaId!.Value).ToList();
        var movimentos = await _context.Transacoes.AsNoTracking()
            .Where(t => t.ContaId != null && caixinhas.Contains(t.ContaId.Value) && t.EhTransferencia
                        && t.StatusTransacao == StatusTransacao.Executado && t.Data >= desde)
            .Select(t => new { Conta = t.ContaId!.Value, t.Data, Valor = t.Tipo == TipoTransacao.Receita ? t.Valor : -t.Valor })
            .ToListAsync();
        decimal Liquido(Guid conta, DateOnly de, DateOnly? ate = null) =>
            movimentos.Where(x => x.Conta == conta && x.Data >= de && (ate is null || x.Data < ate)).Sum(x => x.Valor);
        var metasDoMes = metas
            .Select(m =>
            {
                var guardadoNoInicio = m.Guardado - Liquido(m.ContaId!.Value, referencia);
                var (_, _, pedido) = MetaService.Situacao(m.ValorAlvo, guardadoNoInicio, m.DataLimite, m.CriadoEm,
                    referencia.ToDateTime(TimeOnly.MinValue));
                return new MetaDoOrcamentoDto(m.Id, m.Nome, m.Icone, pedido ?? 0m,
                    Math.Max(0m, Liquido(m.ContaId!.Value, inicio, fim)), m.Falta);
            })
            .OrderByDescending(m => m.PorMes)
            .ToList();

        var praGuardar = metasDoMes.Sum(m => m.PorMes);
        var aAlocar = renda.Previsto - despesas.TotalLimite - praGuardar;
        return new OrcamentoDoMesDto(ano, mes, renda.Previsto, renda.Recebido, despesas.TotalLimite, despesas.TotalGasto,
            praGuardar, metasDoMes.Sum(m => m.GuardadoNoMes), metasDoMes, aAlocar,
            Responder(mes, renda.Previsto, aAlocar));
    }

    /// <summary>A pergunta da tela: "toda a minha renda tem destino?". Uma frase, como fato, e o que fazer.</summary>
    public static RespostaDto Responder(int mes, decimal rendaEsperada, decimal aAlocar)
    {
        var nome = MesesPt.Nome(mes);
        if (rendaEsperada <= 0)
            return new RespostaDto("neutro", $"Diga quanto você espera receber em {nome} pra distribuir a renda.", []);
        if (Math.Abs(aAlocar) < 0.005m)
            return new RespostaDto("positivo", $"Toda a renda de {nome} tem destino.", []);
        if (aAlocar > 0)
            return new RespostaDto("neutro",
                $"Faltam {Reais.Formatar(aAlocar)} da renda de {nome} sem destino: planeje numa categoria ou guarde numa meta.", []);
        return new RespostaDto("negativo",
            $"O planejado passa a renda esperada de {nome} em {Reais.Formatar(-aAlocar)}: diminua uma categoria ou estique o prazo de uma meta.", []);
    }
}
