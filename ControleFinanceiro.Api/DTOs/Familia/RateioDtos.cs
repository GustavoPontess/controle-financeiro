using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.DTOs.Familia;

public record DefinirModoRateioDto(ModoRateio Modo);

public record DefinirRendaDto(decimal? RendaMensal);

public record RateioItemDto(Guid UsuarioId, decimal Percentual);

public record DefinirRateioTransacaoDto(ModoRateio Modo, List<RateioItemDto>? Itens);

public record RateioTransacaoDto(ModoRateio? Modo, List<RateioItemDto> Itens);
