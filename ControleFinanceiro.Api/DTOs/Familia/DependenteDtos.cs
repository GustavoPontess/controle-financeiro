using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.DTOs.Familia;

public record CriarDependenteDto(
    [property: Required][property: MaxLength(120)] string Nome,
    [property: MaxLength(60)] string? Apelido,
    DateTime? DataNascimento,
    TipoDependente Tipo);

public record DependenteDto(
    Guid Id,
    Guid FamiliaId,
    string Nome,
    string? Apelido,
    DateTime? DataNascimento,
    TipoDependente Tipo,
    bool Ativo);

public record AtribuirDependenteDto(Guid? DependenteId);

public record GastoDependenteDto(
    Guid DependenteId,
    string Nome,
    int Mes,
    int Ano,
    decimal Total);
