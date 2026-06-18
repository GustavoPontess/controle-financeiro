using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.DTOs.Familia;

public record CriarFamiliaDto(string Nome);

public record EditarPapelDto(string Papel);

/// <summary>Feature 2.3 — admin promove/rebaixa a permissão de um membro.</summary>
public record EditarPermissaoDto(PapelFamilia PapelPermissao);

/// <summary>Feature 2.4 — define/limpa o limite de aprovação da família. Null = desliga.</summary>
public record DefinirLimiteAprovacaoDto(decimal? LimiteAprovacao);

public record FamiliaDto(
    Guid Id,
    string Nome,
    Guid CriadoPorUsuarioId,
    DateTime CriadoEm,
    bool EhAdmin,
    int TotalMembros,
    decimal? LimiteAprovacao);

public record MembroFamiliaDto(
    Guid Id,
    Guid UsuarioId,
    string NomeUsuario,
    string EmailUsuario,
    string Papel,
    DateTime EntrouEm,
    decimal? RendaMensal,
    PapelFamilia PapelPermissao);

public record FamiliaDetalheDto(
    Guid Id,
    string Nome,
    Guid CriadoPorUsuarioId,
    DateTime CriadoEm,
    bool EhAdmin,
    ModoRateio ModoRateioPadrao,
    List<MembroFamiliaDto> Membros,
    List<ConviteFamiliaDto> ConvitesPendentes,
    decimal? LimiteAprovacao);
