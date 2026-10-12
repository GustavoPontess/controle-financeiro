using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.DTOs.Importacao;

/// <summary>Uma linha do extrato lida do arquivo, já deduplicada e com sugestão.
/// <c>PixNoCredito</c>: perna do Pix no Crédito (a entrada do cartão ou o Pix que ela pagou) — entra no
/// saldo, mas não é receita/despesa. A confirmação detecta de novo no servidor (não confia nesta flag).</summary>
public record ExtratoLinhaDto(
    DateTime Data,
    string Descricao,
    decimal Valor,
    TipoTransacao Tipo,
    string? FitId,
    bool Duplicada,
    Guid? CategoriaSugeridaId,
    string? CategoriaSugeridaNome,
    bool PixNoCredito = false);

/// <summary>Resultado do parse de um extrato — nada foi salvo ainda.</summary>
public record PreviewImportacaoDto(
    List<ExtratoLinhaDto> Linhas,
    int Total,
    int Duplicadas);

/// <summary>Uma linha aprovada pelo usuário para virar transação.</summary>
public record LinhaImportarDto(
    DateTime Data,
    [property: MaxLength(255)] string Descricao,
    decimal Valor,
    TipoTransacao Tipo,
    [property: MaxLength(255)] string? FitId,
    Guid? CategoriaId);

/// <summary>Confirmação da importação: conta de destino + linhas aprovadas.</summary>
public record ConfirmarImportacaoDto(
    Guid ContaId,
    List<LinhaImportarDto> Linhas);

/// <summary>Resultado da confirmação.</summary>
public record ResultadoImportacaoDto(int Importadas);
