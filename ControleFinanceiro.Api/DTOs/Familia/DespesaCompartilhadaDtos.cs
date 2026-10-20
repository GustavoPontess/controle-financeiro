using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.DTOs.Familia;

public record CompartilharTransacaoDto(Guid FamiliaId);

/// <summary>Feature 2.1 — atribui/limpa o membro responsável por uma despesa. Null = limpar.</summary>
public record AtribuirResponsavelDto(Guid? ResponsavelUsuarioId);

public record DespesaCompartilhadaDto(
    Guid Id,
    string Descricao,
    decimal Valor,
    DateTime Data,
    string? CategoriaNome,
    Guid PagadorUsuarioId,
    string PagadorNome,
    StatusAprovacaoDespesa StatusAprovacao,
    string? AprovadoPorNome,
    Guid? ResponsavelUsuarioId,
    string? ResponsavelNome,
    /// <summary>A parte gravada de quem pediu a lista (null quando não entra na divisão).</summary>
    decimal? MinhaParte = null,
    /// <summary>Pro filtro de categoria das Transações da família.</summary>
    Guid? CategoriaId = null);

/// <summary>Conta fixa da casa na aba Contas fixas da família: quem paga, o dia e a cobrança do mês (paga ou prevista)
/// com a parte de quem olha. A conta de onde sai não aparece pros outros (é da pessoa).</summary>
public record ContaFixaDaCasaDto(
    Guid RecorrenteId,
    string Descricao,
    decimal Valor,
    int Dia,
    Guid PagadorUsuarioId,
    string PagadorNome,
    string? CategoriaNome,
    bool EhMinha,
    DateOnly? CobrancaData,
    bool? CobrancaPaga,
    decimal? MinhaParte);

public record SaldoMembroDto(
    Guid UsuarioId,
    string Nome,
    decimal Pagou,
    decimal Cota,
    decimal Saldo,
    /// <summary>Saiu da família (continua no equilíbrio dos meses em que dividiu).</summary>
    DateTime? SaiuEm = null);

public record BalancoFamiliaDto(
    int Mes,
    int Ano,
    ModoRateio Modo,
    decimal Total,
    decimal Cota,
    List<SaldoMembroDto> Saldos);
