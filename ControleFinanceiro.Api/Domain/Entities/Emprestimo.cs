using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

public class Emprestimo
{
    public Guid Id { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public string Pessoa { get; set; } = string.Empty;
    public decimal ValorTotal { get; set; }
    public decimal ValorPago { get; set; } = 0;
    public TipoEmprestimo Tipo { get; set; }
    public DateTime DataInicio { get; set; }
    public DateTime? DataVencimento { get; set; }
    public bool Quitado { get; set; } = false;
    public string? Observacao { get; set; }
    public Guid CriadoPor { get; set; }

    /// <summary>Soft delete — nunca _context.Remove() (CLAUDE.md).</summary>
    public bool Ativo { get; set; } = true;

    /// <summary>Vincula ao lançamento (Transacao) que representa a saída/entrada real do
    /// dinheiro — ex.: o Pix que originou o empréstimo. Opcional: setado só quando o
    /// empréstimo é criado junto com um lançamento (o dinheiro já saiu/entrou de fato).</summary>
    public Guid? TransacaoId { get; set; }
    public Transacao? Transacao { get; set; }

    // Vínculo bilateral (docs/features/emprestimo-compartilhado/spec.md).
    // Só setado no aceite explícito — antes disso é null, mesmo padrão de MembroFamilia.UsuarioId.
    public Guid? ContraparteUsuarioId { get; set; }
    public Usuario? ContraparteUsuario { get; set; }
    public StatusVinculoEmprestimo StatusVinculo { get; set; } = StatusVinculoEmprestimo.SemVinculo;
    public string? EmailContraparte { get; set; }
    public string? ConviteTokenHash { get; set; }
    public DateTime? ConviteExpiraEm { get; set; }
    public DateTime? VinculoRespondidoEm { get; set; }

    // Forma de pagamento (docs/features/emprestimo-compartilhado/parcelamento-e-agrupamento.md).
    public FormaPagamentoEmprestimo FormaPagamento { get; set; } = FormaPagamentoEmprestimo.AVista;

    /// <summary>% mensal, aplicado sobre o valor de cada parcela (não sobre saldo devedor, não
    /// composto). Só usado se FormaPagamento == Parcelado.</summary>
    public decimal? TaxaJuroMensal { get; set; }

    /// <summary>% livre (sem teto/mínimo), aplicado uma vez sobre o valor da parcela quando ela
    /// atrasa. Só usado se FormaPagamento == Parcelado.</summary>
    public decimal? PercentualMultaAtraso { get; set; }

    public ICollection<EmprestimoParcela> Parcelas { get; set; } = new List<EmprestimoParcela>();
}
