namespace ControleFinanceiro.Api.Domain.Enums;

/// <summary>
/// Tipo de evento registrado em FinancialEventLog (audit log financeiro).
/// Não é event sourcing — é audit trail append-only que vive ao lado do estado mutável.
/// Spec: ARQUITETURA_PARCELAMENTO.md § "FinancialEventType (enum)".
/// </summary>
/// <remarks>
/// Valores são espaçados em blocos por entidade afetada (parcelamento, parcela,
/// fatura, limite, recorrente, transação) pra permitir adicionar novos eventos
/// dentro de cada bloco sem renumerar.
/// </remarks>
public enum FinancialEventType
{
    // Parcelamento
    ParcelamentoCriado = 1,
    ParcelamentoCancelado = 2,

    // Parcela
    ParcelaPaga = 10,
    ParcelaCancelada = 11,

    // Fatura
    FaturaFechada = 20,
    FaturaMarcadaAtrasada = 21,
    FaturaPagaTotal = 22,
    FaturaPagaParcial = 23,

    // Limite
    LimiteBloqueado = 30,
    LimiteLiberado = 31,

    // Recorrente
    RecorrenteCriada = 40,
    RecorrenteCancelada = 41,
    RecorrenteExecutada = 42,

    // Transação
    TransacaoCriada = 50,
    TransacaoCancelada = 51,

    // Família — acerto de contas (settle-up)
    AcertoRegistrado = 60,
    AcertoCancelado = 61,
}
