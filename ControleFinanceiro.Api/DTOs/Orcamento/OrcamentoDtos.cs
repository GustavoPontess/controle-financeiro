using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.DTOs.DinheiroDoMes;

namespace ControleFinanceiro.Api.DTOs.Orcamento;

/// <summary>
/// Pôr ou mudar o limite de uma categoria a partir de um mês (vale todo mês até mudar). <c>CategoriaId</c> null =
/// limite de todos os gastos do mês.
/// </summary>
public record DefinirLimiteDto(
    Guid? CategoriaId,
    [Range(2000, 2100)] int Ano,
    [Range(1, 12)] int Mes,
    [Range(0.01, 999_999_999.99, ErrorMessage = "Diga o limite.")] decimal Valor);

/// <summary>
/// Um limite no mês. <c>Situacao</c>: "passou" (gastou mais que o limite) · "vai-passar" (ainda não, mas com o que
/// ainda vem passa) · "perto" (passou do alerta, 80% por padrão) · "ok". <c>Sobra</c> negativa = quanto passou (só o
/// que já aconteceu). <c>AindaVem</c>: as contas previstas da categoria no mês. <c>Resposta</c>: a frase que responde
/// "e agora?" (null quando não há o que dizer). <c>DesdeAno</c>/<c>DesdeMes</c>: de quando vale este valor.
/// </summary>
public record LimiteDoMesDto(
    Guid? CategoriaId,
    string Categoria,
    decimal Limite,
    decimal Gasto,
    decimal Previsto,
    decimal Sobra,
    decimal Percentual,
    string Situacao,
    int DesdeAno,
    int DesdeMes,
    decimal PercentualAlerta,
    List<AindaVemDto> AindaVem,
    string? Resposta,
    decimal ParcelasFuturas,
    int? ParcelasAteAno,
    int? ParcelasAteMes);

/// <summary>Categoria com gasto no mês e sem limite (a tela oferece "Pôr limite").</summary>
public record GastoSemLimiteDto(Guid? CategoriaId, string Categoria, decimal Gasto);

/// <summary>
/// A tela de Limites de um mês. <c>Editavel</c>: mês atual ou futuro (mês passado fica como estava). Os totais
/// somam só as categorias com limite próprio (o limite de "todos os gastos", se houver, não entra pra não contar
/// duas vezes).
/// </summary>
public record LimitesDoMesDto(
    int Ano,
    int Mes,
    bool Editavel,
    decimal TotalLimite,
    decimal TotalGasto,
    decimal TotalPrevisto,
    List<LimiteDoMesDto> Limites,
    List<GastoSemLimiteDto> SemLimite);

/// <summary>Quanto a pessoa gastou na categoria, em média, nos 3 meses antes do mês (null = nada gasto).</summary>
public record SugestaoLimiteDto(decimal? MediaUltimos3Meses);
