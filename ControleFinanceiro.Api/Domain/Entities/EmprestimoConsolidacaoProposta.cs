using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Proposta do credor de juntar N empréstimos ativos que ele tem com a mesma contraparte
/// vinculada num plano novo renegociado (soma o que falta, redefine forma de pagamento). Só vale
/// depois do devedor aceitar — até lá, nenhum dos empréstimos originais é tocado. Espelha o
/// padrão de vínculo bilateral (credor propõe, devedor decide).
/// Spec: docs/features/emprestimo-compartilhado/parcelamento-e-agrupamento.md § "Unificar/consolidar".
/// </summary>
public class EmprestimoConsolidacaoProposta
{
    public Guid Id { get; set; }

    public Guid CredorUsuarioId { get; set; }
    public Usuario CredorUsuario { get; set; } = null!;

    public Guid DevedorUsuarioId { get; set; }
    public Usuario DevedorUsuario { get; set; } = null!;

    public string Descricao { get; set; } = string.Empty;

    // Forma de pagamento do plano novo — mesmos campos de CriarEmprestimoDto/Emprestimo.
    public FormaPagamentoEmprestimo FormaPagamento { get; set; } = FormaPagamentoEmprestimo.AVista;
    public int? QuantidadeParcelas { get; set; }
    public DateTime? PrimeiroVencimento { get; set; }

    /// <summary>Só usado se FormaPagamento == AVista — vencimento único do plano novo.</summary>
    public DateTime? DataVencimento { get; set; }
    public decimal? TaxaJuroMensal { get; set; }
    public decimal? PercentualMultaAtraso { get; set; }

    /// <summary>Soma do restante (ValorTotal - ValorPago) dos empréstimos incluídos, no momento
    /// da proposta — só informativo pro devedor avaliar. Recalculado de verdade (não confiado
    /// como snapshot) na hora do aceite, pra cobrir o caso de algo ter mudado nesse meio tempo.</summary>
    public decimal ValorTotalProposto { get; set; }

    public StatusConsolidacaoEmprestimo Status { get; set; } = StatusConsolidacaoEmprestimo.Pendente;

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime? RespondidoEm { get; set; }

    /// <summary>Texto livre opcional do devedor ao recusar — mesmo padrão do MotivoRejeicao de
    /// pagamento.</summary>
    public string? MotivoRecusa { get; set; }

    /// <summary>Setado só quando Aceita — aponta pro Emprestimo novo que substituiu os originais.</summary>
    public Guid? EmprestimoConsolidadoId { get; set; }
    public Emprestimo? EmprestimoConsolidado { get; set; }

    public ICollection<EmprestimoConsolidacaoItem> Itens { get; set; } = new List<EmprestimoConsolidacaoItem>();
}
