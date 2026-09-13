using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.DTOs.Familia;

public record CriarConviteDto(
    [property: Required, EmailAddress, MaxLength(255)] string Email,
    [property: Required, MaxLength(30)] string Papel,
    PapelFamilia PapelPermissao = PapelFamilia.Membro);

public record ConviteFamiliaDto(
    Guid Id,
    Guid FamiliaId,
    string NomeFamilia,
    string EmailConvidado,
    string Papel,
    StatusConvite Status,
    DateTime ExpiraEm,
    DateTime CriadoEm,
    string Token,
    PapelFamilia PapelPermissao);
