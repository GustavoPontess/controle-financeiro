using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.DTOs.Familia;

public record RegistrarAcertoDto(
    Guid DeUsuarioId,
    Guid ParaUsuarioId,
    decimal Valor,
    int? Mes,
    int? Ano,
    [MaxLength(1000)] string? Observacao,
    [Required, MaxLength(100)] string IdempotencyKey);

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
