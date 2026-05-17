using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.DTOs.Familia;

public record CriarConviteDto(string Email, string Papel);

public record ConviteFamiliaDto(
    Guid Id,
    Guid FamiliaId,
    string NomeFamilia,
    string EmailConvidado,
    string Papel,
    StatusConvite Status,
    DateTime ExpiraEm,
    DateTime CriadoEm,
    string Token);
