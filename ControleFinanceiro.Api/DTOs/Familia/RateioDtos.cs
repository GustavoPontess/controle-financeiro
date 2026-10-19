using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.DTOs.Familia;

public record DefinirModoRateioDto(ModoRateio Modo);

public record RateioItemDto(Guid UsuarioId, decimal Percentual);

public record DefinirRateioTransacaoDto(ModoRateio Modo, List<RateioItemDto>? Itens);

/// <summary>A parte gravada de um membro (quem já saiu da família também aparece, com <c>SaiuEm</c>).</summary>
public record RateioMembroDto(Guid UsuarioId, string Nome, decimal Percentual, decimal Valor = 0m, DateTime? SaiuEm = null);

public record RateioTransacaoDto(
    ModoRateio? Modo,
    Guid? FamiliaId,
    List<RateioMembroDto> Membros);
