using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.DTOs.Meta;

/// <summary>Retorno de uma meta financeira com progresso calculado.</summary>
public record MetaDto(
    Guid Id,
    string Nome,
    string? Descricao,
    decimal ValorAlvo,
    decimal ValorAtual,
    decimal PercentualConcluido,
    bool Concluida,
    DateTime? DataLimite,
    Guid UsuarioId,
    Guid? FamiliaId,
    Guid? CategoriaId,
    bool Ativo,
    DateTime CriadoEm,
    DateTime AtualizadoEm);

/// <summary>Criação ou atualização de uma meta.</summary>
public record CriarMetaDto(
    [Required][MaxLength(120)] string Nome,
    [MaxLength(500)] string? Descricao,
    [Range(0.01, double.MaxValue, ErrorMessage = "ValorAlvo deve ser positivo.")] decimal ValorAlvo,
    DateTime? DataLimite,
    Guid? FamiliaId,
    Guid? CategoriaId);

/// <summary>Adiciona um valor ao progresso da meta (contribuição manual).</summary>
public record ContribuirMetaDto(
    [Range(0.01, double.MaxValue, ErrorMessage = "Valor deve ser positivo.")] decimal Valor);
