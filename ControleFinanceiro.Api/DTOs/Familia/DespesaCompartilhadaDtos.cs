using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.DTOs.Familia;

public record CompartilharTransacaoDto(Guid FamiliaId);

public record DespesaCompartilhadaDto(
    Guid Id,
    string Descricao,
    decimal Valor,
    DateTime Data,
    string? CategoriaNome,
    Guid PagadorUsuarioId,
    string PagadorNome);

public record SaldoMembroDto(
    Guid UsuarioId,
    string Nome,
    decimal Pagou,
    decimal Cota,
    decimal Saldo);

public record BalancoFamiliaDto(
    int Mes,
    int Ano,
    ModoRateio Modo,
    decimal Total,
    decimal Cota,
    List<SaldoMembroDto> Saldos);
