using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.DTOs.Familia;

public record CriarFamiliaDto(string Nome);

public record EditarPapelDto(string Papel);

public record FamiliaDto(
    Guid Id,
    string Nome,
    Guid CriadoPorUsuarioId,
    DateTime CriadoEm,
    bool EhAdmin,
    int TotalMembros);

public record MembroFamiliaDto(
    Guid Id,
    Guid UsuarioId,
    string NomeUsuario,
    string EmailUsuario,
    string Papel,
    DateTime EntrouEm,
    decimal? RendaMensal);

public record FamiliaDetalheDto(
    Guid Id,
    string Nome,
    Guid CriadoPorUsuarioId,
    DateTime CriadoEm,
    bool EhAdmin,
    ModoRateio ModoRateioPadrao,
    List<MembroFamiliaDto> Membros,
    List<ConviteFamiliaDto> ConvitesPendentes);
