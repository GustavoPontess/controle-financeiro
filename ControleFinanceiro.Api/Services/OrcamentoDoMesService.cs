using ControleFinanceiro.Api.DTOs.DinheiroDoMes;
using ControleFinanceiro.Api.DTOs.Orcamento;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// O orçamento do mês ("base zero", como a planilha do Gustavo, 2026-10-21): a renda que a pessoa espera receber
/// ganha destino nas despesas planejadas e nos investimentos planejados (as duas por categoria, em
/// <see cref="OrcamentoService"/>). O que sobra é o "a ser alocado"; zerado, toda a renda tem destino. Metas ficam
/// fora (2026-10-22, decisão do Gustavo: a seção Investimentos é só de categoria e subcategoria; meta mora em Metas).
/// Nenhuma regra nova: renda, planejado e realizado vêm de onde já moram.
/// </summary>
public class OrcamentoDoMesService
{
    private readonly RendaService _renda;
    private readonly OrcamentoService _orcamentos;

    public OrcamentoDoMesService(RendaService renda, OrcamentoService orcamentos)
    {
        _renda = renda;
        _orcamentos = orcamentos;
    }

    public async Task<OrcamentoDoMesDto> CalcularAsync(Guid usuarioId, int ano, int mes)
    {
        var renda = await _renda.ObterMesAsync(usuarioId, ano, mes); // valida o mês
        var despesas = await _orcamentos.DoMesAsync(usuarioId, ano, mes);
        var investimentos = await _orcamentos.InvestimentosDoMesAsync(usuarioId, ano, mes);
        var aAlocar = renda.Previsto - despesas.TotalLimite - investimentos.TotalPlanejado;
        return new OrcamentoDoMesDto(ano, mes, renda.Previsto, renda.Recebido, despesas.TotalLimite, despesas.TotalGasto,
            investimentos.TotalPlanejado, investimentos.TotalRealizado, aAlocar, Responder(mes, renda.Previsto, aAlocar));
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
                $"Faltam {Reais.Formatar(aAlocar)} da renda de {nome} sem destino: planeje numa categoria ou num investimento.", []);
        return new RespostaDto("negativo",
            $"O planejado passa a renda esperada de {nome} em {Reais.Formatar(-aAlocar)}: diminua uma categoria ou um investimento.", []);
    }
}
