using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;


namespace ControleFinanceiro.Api.Domain.Entities;

public class Transacao
{
    public Guid Id { get; set; }

    [Required]
    [MaxLength(400)]
    public string Descricao { get; set; } = string.Empty;

    [Range(0.01, double.MaxValue)]
    public decimal Valor { get; set; }

    [Required]
    public TipoTransacao Tipo { get; set; }

    public Guid? CategoriaId { get; set; }
    public Categoria? Categoria { get; set; }

    /// <summary>Issue #83 — subcategoria opcional (granularidade abaixo da Categoria).</summary>
    public Guid? SubcategoriaId { get; set; }
    public Subcategoria? Subcategoria { get; set; }

    public Guid? ContaId { get; set; }
    public Conta? Conta { get; set; }

    public Guid? CartaoCreditoId { get; set; }
    public CartaoCredito? CartaoCredito { get; set; }

    public bool UsadoComoCredito { get; set; }

    public MeioPagamento? MeioPagamento { get; set; }

    // Fatura à qual esta transação de cartão de crédito pertence
    public Guid? FaturaId { get; set; }
    public Fatura? Fatura { get; set; }

    public Guid CriadoPor { get; set; }

    /// <summary>Issue #23 — quando preenchido, esta Transacao é uma despesa
    /// compartilhada com a família indicada. Null = despesa pessoal.</summary>
    public Guid? FamiliaId { get; set; }
    public Familia? Familia { get; set; }

    /// <summary>Issue #24 — despesa atribuída a um dependente (gasto com filho,
    /// idoso, pet). Null = não atribuída.</summary>
    public Guid? DependenteId { get; set; }
    public Dependente? Dependente { get; set; }

    /// <summary>Feature 2.1 — despesa compartilhada atribuída a um membro responsável
    /// da família (quem o gasto representa). Null = não atribuída. Distinto de CriadoPor.</summary>
    public Guid? ResponsavelUsuarioId { get; set; }

    /// <summary>Issue #25 — override do modo de rateio para esta despesa. Null =
    /// usa o modo padrão da família.</summary>
    public ModoRateio? ModoRateio { get; set; }
    public ICollection<RateioTransacao> Rateios { get; set; } = new List<RateioTransacao>();

    /// <summary>Feature 2.4 — estado de aprovação quando compartilhada com família.
    /// Só relevante com FamiliaId != null. Pendente/Rejeitada não contam no balanço.</summary>
    public StatusAprovacaoDespesa StatusAprovacao { get; set; } = StatusAprovacaoDespesa.NaoRequerida;

    /// <summary>Quem aprovou/rejeitou a despesa compartilhada (membro ≠ criador). Null se não avaliada.</summary>
    public Guid? AprovadoPorUsuarioId { get; set; }

    public DateTime? AprovadoEm { get; set; }

    /// <summary>Dia do lançamento — <c>date</c> puro, sem fuso. A hora fica em <see cref="Hora"/>.
    /// Separado de hora (#fuso): timestamp único vinha sem 'Z' no JSON e o front deslocava +3h.</summary>
    [Required]
    public DateOnly Data { get; set; }

    /// <summary>Hora do lançamento — <c>time</c> puro, sem fuso. Null = lançamento SEM hora
    /// (recorrente, saldo inicial, importação, ou data passada sem horário real). A tela só mostra
    /// a hora quando ela existe.</summary>
    public TimeOnly? Hora { get; set; }

    public Guid? RecorrenteOrigemId { get; set; }

    // ── Novos vínculos ao sistema de Parcelamento (ARQUITETURA_PARCELAMENTO.md § "Transacao (Mudanças)") ──

    /// <summary>Vincula esta Transacao ao Parcelamento que a originou (se aplicável).</summary>
    public Guid? ParcelamentoId { get; set; }
    public Parcelamento? Parcelamento { get; set; }

    /// <summary>Vincula esta Transacao à parcela específica (se aplicável).</summary>
    public Guid? ParcelaTransacaoId { get; set; }
    public ParcelaTransacao? ParcelaTransacao { get; set; }

    // ── Status, soft delete e marcador de pagamento de fatura ──

    /// <summary>Diferencia previsão (Recorrente futura), executada (real) e cancelada.</summary>
    public StatusTransacao StatusTransacao { get; set; } = StatusTransacao.Executado;

    /// <summary>true se esta Transacao representa o pagamento de uma Fatura (rota especial — ponte conta↔cartão).</summary>
    public bool EhPagamentoFatura { get; set; }

    /// <summary>Quando EhPagamentoFatura=true, qual Fatura foi quitada.</summary>
    public Guid? FaturaPagaId { get; set; }
    public Fatura? FaturaPaga { get; set; }

    /// <summary>true se esta Transacao é uma das pernas de uma Transferência entre contas.
    /// Move saldo entre contas, mas NÃO é receita/despesa real — excluída de relatórios de P&amp;L.</summary>
    public bool EhTransferencia { get; set; }

    /// <summary>true se esta Transacao é o saldo de abertura de uma conta. Compõe o saldo,
    /// mas NÃO é receita real — excluída de relatórios de P&amp;L.</summary>
    public bool EhSaldoInicial { get; set; }

    /// <summary>true se esta Transacao é um lançamento de AJUSTE criado por um marco de reconciliação
    /// pra fechar a diferença entre o saldo declarado e o calculado. Compõe o saldo (corrige-o), mas
    /// NÃO é receita/despesa real — fora de relatórios de P&amp;L. Ver ReconciliacaoSaldo.</summary>
    public bool EhAjusteReconciliacao { get; set; }

    /// <summary>Soft delete: true=ativa, false=cancelada (preserva histórico).</summary>
    public bool Ativo { get; set; } = true;

    public DateTime? CanceladoEm { get; set; }

    [MaxLength(400)]
    public string? MotivoCancelamento { get; set; }

    /// <summary>Timestamp de criação (auditoria).</summary>
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    /// <summary>Issue #27 — FITID do OFX quando a transação veio de importação
    /// de extrato. Usado para deduplicar reimportações. Null = lançamento manual.</summary>
    [MaxLength(120)]
    public string? ImportacaoFitId { get; set; }
}