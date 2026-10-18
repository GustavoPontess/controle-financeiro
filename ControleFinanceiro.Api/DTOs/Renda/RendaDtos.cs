using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.DTOs.Renda;

/// <summary>A renda de um mês da pessoa: o que entrou (fato) e o que ela esperava (contas fixas + variável).</summary>
public record RendaMesDto(
    int Ano,
    int Mes,
    /// <summary>Fixas + variável esperada.</summary>
    decimal Previsto,
    /// <summary>Contas fixas de receita do mês (já recebidas ou ainda previstas).</summary>
    decimal Fixas,
    /// <summary>A variável esperada que vale neste mês (a do mês, ou herdada do último mês que tem).</summary>
    decimal VariavelEsperada,
    /// <summary>A variável foi definida neste mês mesmo (false = herdada ou nenhuma).</summary>
    bool VariavelDoMes,
    /// <summary>Receitas de renda que já caíram no mês.</summary>
    decimal Recebido,
    /// <summary>Previsto menos recebido, quando ainda falta; zero quando já passou.</summary>
    decimal Falta,
    /// <summary>Média do recebido nos 3 meses anteriores com renda (sugestão quando não há previsto). Null sem histórico.</summary>
    decimal? SugestaoMedia3Meses,
    List<EntradaRendaDto> Entradas);

public record EntradaRendaDto(Guid Id, DateOnly Data, string Descricao, decimal Valor, string? Subcategoria, bool Recebida, bool ContaFixa);

/// <summary>Define (ou apaga, com null) a variável esperada de um mês.</summary>
public record DefinirVariavelEsperadaDto(
    [Range(2000, 2100)] int Ano,
    [Range(1, 12)] int Mes,
    [Range(0, 1_000_000_000)] decimal? VariavelEsperada);
