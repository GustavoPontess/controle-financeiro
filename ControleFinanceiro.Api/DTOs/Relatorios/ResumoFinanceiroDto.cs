namespace ControleFinanceiro.Api.DTOs.Relatorios
{
    public class ResumoFinanceiroDto
    {
        public Guid PessoaId { get; set; }

        public decimal TotalReceitas { get; set; }

        public decimal TotalDespesas { get; set; }

        public decimal Saldo => TotalReceitas - TotalDespesas;
    }
}