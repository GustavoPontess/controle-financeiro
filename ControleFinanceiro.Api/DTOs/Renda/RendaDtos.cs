using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.DTOs.Renda;

/// <summary>A renda de um mês da pessoa: o que entrou (fato) e o que ela declarou esperar (fixa + variável).</summary>
public record RendaMesDto(
    int Ano,
    int Mes,
    /// <summary>Fixa esperada + variável esperada.</summary>
    decimal Previsto,
    /// <summary>Renda fixa que a pessoa espera (salário, aposentadoria, benefício).</summary>
    decimal FixaEsperada,
    /// <summary>Renda variável que a pessoa espera (comissão, bico, diária).</summary>
    decimal VariavelEsperada,
    /// <summary>O esperado foi declarado neste mês mesmo (false = herdado do último mês que tem, ou nenhum).</summary>
    bool DeclaradoNoMes,
    /// <summary>Receitas de renda que já caíram no mês.</summary>
    decimal Recebido,
    /// <summary>Previsto menos recebido, quando ainda falta; zero quando já passou.</summary>
    decimal Falta,
    /// <summary>Média do recebido nos 3 meses anteriores com renda (sugestão quando não há previsto). Null sem histórico.</summary>
    decimal? SugestaoMedia3Meses,
    List<EntradaRendaDto> Entradas,
    /// <summary>O recebido separado em fixa e variável (pela subcategoria, <c>RendaService.EhFixa</c>).</summary>
    decimal FixaRecebida,
    decimal VariavelRecebida,
    /// <summary>Renda prevista (conta fixa de receita) que ainda vai cair no mês, separada igual.</summary>
    decimal FixaAindaVem,
    decimal VariavelAindaVem);

/// <summary>Uma entrada de renda do mês. <c>Fixa</c>: a subcategoria é de renda fixa (salário, aposentadoria, benefício…).</summary>
public record EntradaRendaDto(Guid Id, DateOnly Data, string Descricao, decimal Valor, string? Subcategoria, bool Recebida, bool Fixa = false);

/// <summary>Declara o que a pessoa espera receber no mês (fixa e variável). Vale até ela mudar de novo.</summary>
public record DefinirRendaPrevistaDto(
    [Range(2000, 2100)] int Ano,
    [Range(1, 12)] int Mes,
    [Range(0, 1_000_000_000)] decimal FixaEsperada,
    [Range(0, 1_000_000_000)] decimal VariavelEsperada);
