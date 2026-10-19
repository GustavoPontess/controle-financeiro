using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.DTOs.Meta;

/// <summary>
/// Meta no modelo de CAIXINHA (como o Nubank; decisão do Gustavo em 2026-10-19): cada meta tem a própria conta
/// (<c>ContaId</c>, tipo Caixinha) e guardar é transferência de verdade da conta da pessoa pra ela.
/// <c>Guardado</c> = saldo da caixinha. <c>Situacao</c>: "concluida" (a pessoa marcou e levou o dinheiro) ·
/// "chegou-la" (guardado ≥ alvo, ainda em andamento) · "sem-prazo" · "prazo-passou" · "no-ritmo" · "atras".
/// <c>Concluida</c> = marcada (<c>ConcluidaEm</c>): só aí a meta vai pra Concluídas e vira REGISTRO (não guarda,
/// resgata, edita nem exclui). <c>PorMes</c> = quanto falta dividido pelos meses até o prazo (contando o atual).
/// <c>ValorAtual</c> = <c>Guardado</c> (compatibilidade com o app antigo).
/// </summary>
public record MetaDto(
    Guid Id,
    string Nome,
    string? Descricao,
    string Icone,
    decimal ValorAlvo,
    decimal Guardado,
    decimal Falta,
    decimal PercentualConcluido,
    bool Concluida,
    DateTime? DataLimite,
    int? MesesRestantes,
    decimal? PorMes,
    string Situacao,
    Guid? ContaId,
    Guid UsuarioId,
    Guid? FamiliaId,
    Guid? CategoriaId,
    bool Ativo,
    DateTime CriadoEm,
    DateTime AtualizadoEm,
    DateTime? ConcluidaEm = null,
    decimal? ValorJuntado = null)
{
    public decimal ValorAtual => Guardado;
}

/// <summary>Criação ou edição. <c>DataLimite</c>: o mês do prazo (o dia é ignorado). <c>Icone</c>: um da lista.</summary>
public record CriarMetaDto(
    [Required][MaxLength(100)] string Nome,
    [MaxLength(500)] string? Descricao,
    [Range(0.01, 999_999_999.99, ErrorMessage = "Diga quanto quer juntar.")] decimal ValorAlvo,
    DateTime? DataLimite,
    Guid? FamiliaId,
    Guid? CategoriaId,
    [MaxLength(30)] string? Icone = null);

/// <summary>Guardar (da conta pra caixinha) ou resgatar (da caixinha pra conta). <c>Data</c> omitida = hoje.</summary>
public record MovimentoMetaDto(
    Guid ContaId,
    [Range(0.01, 999_999_999.99, ErrorMessage = "Diga quanto.")] decimal Valor,
    DateOnly? Data = null);

/// <summary>Concluir a meta que chegou lá: o guardado todo vai pra <c>ContaId</c>. <c>Data</c> omitida = hoje.</summary>
public record ConcluirMetaDto(Guid ContaId, DateOnly? Data = null);

/// <summary>
/// "Essa meta cabe?" (docs/features/respostas/visao.md). <c>PorMes</c>: quanto guardar por mês até o prazo (null sem
/// prazo). <c>Folga</c>: o que sobra por mês = renda esperada − gasto típico SEM parcelas (média dos 3 meses antes) −
/// as parcelas já compradas (média por mês até o prazo, ou nos próximos 12) − o que as outras metas pedem (null
/// quando falta renda ou gasto pra saber). <c>PrazoQueCabe</c>: o mês em que dá pra chegar
/// guardando a folga (quando o prazo não cabe ou não tem prazo). <c>Resposta</c>: a frase.
/// </summary>
/// <summary>
/// "As metas juntas cabem?" (lista de Metas): <c>PedemPorMes</c> = soma do que as metas em andamento pedem por mês;
/// <c>Folga</c> = renda esperada − gasto normal − parcelas já compradas (null quando falta renda ou gasto pra saber);
/// <c>Resposta</c> = a frase (null quando nenhuma meta pede nada por mês).
/// </summary>
public record ViabilidadeDasMetasDto(decimal PedemPorMes, decimal? Folga, ControleFinanceiro.Api.DTOs.DinheiroDoMes.RespostaDto? Resposta);

public record ViabilidadeMetaDto(
    decimal? PorMes,
    int? Meses,
    decimal? Folga,
    decimal? RendaEsperada,
    decimal? GastoTipico,
    decimal OutrasMetasPorMes,
    decimal ParcelasPorMes,
    DateTime? PrazoQueCabe,
    ControleFinanceiro.Api.DTOs.DinheiroDoMes.RespostaDto Resposta);

/// <summary>Uma linha do histórico da meta: quando, se guardou ou resgatou, de/pra qual conta e quanto.</summary>
public record MetaHistoricoDto(Guid TransferenciaId, DateTime Data, string Tipo, Guid ContaId, string ContaNome, decimal Valor);
