namespace ControleFinanceiro.Api.DTOs.Emprestimo;

public class EmprestimoParcelaDto
{
    public Guid Id { get; set; }
    public Guid EmprestimoId { get; set; }
    public int Numero { get; set; }
    public int QuantidadeTotal { get; set; }
    public DateTime DataVencimento { get; set; }
    public decimal Valor { get; set; }
    public decimal? ValorComJuros { get; set; }
    public decimal? ValorComMulta { get; set; }
    public int Status { get; set; }
    public string StatusDescricao { get; set; } = string.Empty;

    /// <summary>Calculado (vencimento no passado e ainda Pendente) — mesmo padrão do
    /// Emprestimo.Vencido, não persistido.</summary>
    public bool Atrasada { get; set; }

    public Guid? SolicitacaoPagamentoId { get; set; }

    /// <summary>Solicitação Pendente (aguardando aprovação de quem lê) ligada a essa parcela, se
    /// houver. Permite o front mostrar alerta + aprovar/rejeitar direto na parcela, sem precisar
    /// abrir o histórico do empréstimo pra achar (achado do Gustavo, 2026-08-12).</summary>
    public Guid? SolicitacaoPendenteId { get; set; }
}
