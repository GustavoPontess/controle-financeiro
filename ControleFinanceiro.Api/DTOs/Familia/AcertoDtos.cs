using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.DTOs.Familia;

public record RegistrarAcertoDto(
    Guid DeUsuarioId,
    Guid ParaUsuarioId,
    decimal Valor,
    int? Mes,
    int? Ano,
    [MaxLength(1000)] string? Observacao,
    [Required, MaxLength(100)] string IdempotencyKey,
    // De qual conta saiu (se quem registra passou) ou em qual entrou (se recebeu). Null = não lança em conta.
    Guid? ContaId = null,
    // Dia em que o dinheiro passou (o da tela; sem ele, hoje).
    DateOnly? Data = null);

/// <summary>Confirmar que recebeu (quem recebeu) ou lançar o seu lado depois: a conta (null = não lança) e o dia.</summary>
public record ContaDoAcertoDto(Guid? ContaId, DateOnly? Data);

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
    DateTime CriadoEm,
    DateOnly? Data = null,
    // Null = esperando quem recebeu confirmar (fora do equilíbrio).
    DateTime? ConfirmadoEm = null,
    // O lançamento DE QUEM PEDE (saída se passou, entrada se recebeu); nunca o do outro.
    Guid? MinhaTransacaoId = null);
