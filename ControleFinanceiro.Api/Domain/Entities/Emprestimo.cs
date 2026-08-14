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

    /// <summary>% mensal. Parcelado: aplicado sobre o valor de cada parcela (ver
    /// EmprestimoParcela.ValorComJuros). À vista: aplicado uma vez sobre ValorTotal na criação
    /// (ver ValorComJuros abaixo) — mesma regra "flat, não composto" dos dois casos.</summary>
    public decimal? TaxaJuroMensal { get; set; }

    /// <summary>% livre (sem teto/mínimo), aplicado uma vez quando atrasa. Parcelado: sobre o
    /// valor de cada parcela. À vista: sobre ValorTotal (ver ValorComMulta abaixo).</summary>
    public decimal? PercentualMultaAtraso { get; set; }

    /// <summary>À vista com TaxaJuroMensal: ValorTotal*(1+Taxa/100), calculado uma vez na
    /// criação. Null se Parcelado (ali o juro é por parcela) ou sem taxa informada.</summary>
    public decimal? ValorComJuros { get; set; }

    /// <summary>À vista vencido com PercentualMultaAtraso: ValorTotal*(1+Multa/100), snapshot na
    /// 1ª leitura após o vencimento (não recalcula depois — mesmo padrão da parcela). Null se
    /// Parcelado, sem multa configurada, ou ainda não venceu.</summary>
    public decimal? ValorComMulta { get; set; }

    public ICollection<EmprestimoParcela> Parcelas { get; set; } = new List<EmprestimoParcela>();

    /// <summary>Arquivar é decisão pessoal de organização, não estado compartilhado — cada lado
    /// esconde da própria lista principal sem afetar a visão do outro nem apagar nada. Só permitido
    /// quando Quitado (achado do Gustavo, 2026-08-13: "quando eu quito ele fica meio apagado mas
    /// não consigo excluir" — apagar quitado fica travado de propósito, protege histórico
    /// compartilhado; arquivar resolve a poluição visual sem esse risco).</summary>
    public bool ArquivadoPorCriador { get; set; } = false;
    public bool ArquivadoPorContraparte { get; set; } = false;

    /// <summary>Setado quando este empréstimo foi absorvido por uma consolidação aceita — aponta
    /// pro Emprestimo novo que o substituiu. Empréstimo consolidado também vira Quitado (o saldo
    /// dele foi transferido pro plano novo, não pago de verdade) e é auto-arquivado dos dois
    /// lados (registro superado, não precisa mais aparecer na lista principal).
    /// Spec: docs/features/emprestimo-compartilhado/parcelamento-e-agrupamento.md § "Unificar/consolidar".</summary>
    public Guid? ConsolidadoNoEmprestimoId { get; set; }
    public Emprestimo? ConsolidadoNoEmprestimo { get; set; }
}
