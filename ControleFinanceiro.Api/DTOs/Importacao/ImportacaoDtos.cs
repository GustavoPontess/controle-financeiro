using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.DTOs.Importacao;

/// <summary>Uma linha do extrato lida do arquivo, já deduplicada e com sugestão.
/// <c>PixNoCredito</c>: perna do Pix no Crédito (a entrada do cartão ou o Pix que ela pagou) — entra no
/// saldo, mas não é receita/despesa. <c>PagaFaturaFechamento</c>: "Pagamento de fatura" que vai quitar a
/// fatura do app que fecha nessa data (o rótulo da tela Cartões); null = fica como despesa. A confirmação
/// decide as duas de novo no servidor (não confia na prévia). <c>Natureza</c> (2026-11-01): o que o sinal não diz
/// ("entre-contas", "emprestimo", "investimento"; null = comum); <c>JuntaComConta</c>: a conta da outra perna que já
/// está no app, quando é entre suas contas.</summary>
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
    DateTime? PagaFaturaFechamento = null,
    string? Natureza = null,
    string? JuntaComConta = null);

/// <summary>
/// Resultado do parse de um extrato — nada foi salvo ainda. No CSV vem também a tabela (colunas + até 5
/// linhas de amostra), o mapeamento usado e a assinatura do cabeçalho. <c>PrecisaMapear</c>: não deu pra
/// reconhecer as colunas (ou o mapeamento não leu nada) — a tela pergunta e manda a prévia de novo com o
/// <see cref="MapeamentoCsvDto"/>. <c>MapeamentoLembrado</c>: veio do que a pessoa já escolheu nessa conta.
/// </summary>
public record PreviewImportacaoDto(
    List<ExtratoLinhaDto> Linhas,
    int Total,
    int Duplicadas,
    string Formato = "ofx",
    bool PrecisaMapear = false,
    string[]? Colunas = null,
    List<string[]>? Amostra = null,
    MapeamentoCsvDto? Mapeamento = null,
    string? Assinatura = null,
    bool MapeamentoLembrado = false);

/// <summary>Qual coluna (índice, a partir de 0) do CSV é o quê. Valor assinado OU Entrada + Saída.</summary>
public record MapeamentoCsvDto(
    [Range(0, 200)] int Data,
    [Range(0, 200)] int Descricao,
    [Range(0, 200)] int? Valor,
    [Range(0, 200)] int? Entrada,
    [Range(0, 200)] int? Saida,
    [Range(0, 200)] int? Id,
    bool InverterSinal);

/// <summary>Uma linha aprovada pelo usuário para virar transação.</summary>
public record LinhaImportarDto(
    DateTime Data,
    [MaxLength(255)] string Descricao,
    decimal Valor,
    TipoTransacao Tipo,
    [MaxLength(255)] string? FitId,
    Guid? CategoriaId);

/// <summary>
/// Confirmação da importação: conta de destino + linhas aprovadas. Com <c>Mapeamento</c> + <c>Assinatura</c>
/// (CSV que a pessoa mapeou), o servidor lembra as colunas pra essa conta na mesma transação.
/// </summary>
public record ConfirmarImportacaoDto(
    Guid ContaId,
    List<LinhaImportarDto> Linhas,
    MapeamentoCsvDto? Mapeamento = null,
    [MaxLength(300)] string? Assinatura = null);

/// <summary>
/// Resultado da confirmação. <c>JaExistiam</c>: linhas com FITID que já está na conta (o servidor pula, mesmo
/// que a prévia tenha mandado). <c>Repetido</c>: a mesma confirmação já tinha sido feita (Idempotency-Key) —
/// nada foi gravado de novo.
/// </summary>
public record ResultadoImportacaoDto(int Importadas, int JaExistiam = 0, bool Repetido = false);
