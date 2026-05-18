namespace ControleFinanceiro.Api.DTOs.Familia;

public record RegistrarAcertoDto(
    Guid DeUsuarioId,
    Guid ParaUsuarioId,
    decimal Valor,
    int? Mes,
    int? Ano,
    string? Observacao);

public record AcertoContasDto(
    Guid Id,
    Guid DeUsuarioId,
    string DeNome,
    Guid ParaUsuarioId,
    string ParaNome,
    decimal Valor,
    int Mes,
    int Ano,
    string? Observacao,
    DateTime CriadoEm);
