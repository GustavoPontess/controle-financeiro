using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.DTOs.Importacao;

/// <summary>Uma linha do extrato lida do arquivo, já deduplicada e com sugestão.
/// <c>PixNoCredito</c>: perna do Pix no Crédito (a entrada do cartão ou o Pix que ela pagou) — entra no
/// saldo, mas não é receita/despesa. <c>PagaFaturaFechamento</c>: "Pagamento de fatura" que vai quitar a
/// fatura do app que fecha nessa data (o rótulo da tela Cartões); null = fica como despesa. A confirmação
/// decide as duas de novo no servidor (não confia na prévia).</summary>
public record ExtratoLinhaDto(
    DateTime Data,
    string Descricao,
    decimal Valor,
    TipoTransacao Tipo,
    string? FitId,
    bool Duplicada,
    Guid? CategoriaSugeridaId,
    string? CategoriaSugeridaNome,
    bool PixNoCredito = false,
    DateTime? PagaFaturaFechamento = null);

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
