namespace ControleFinanceiro.Api.DTOs.Relatorios
{
    public class RelatorioTotaisPessoaDto
    {
        public List<PessoaResumoDto> Pessoas { get; set; } = new();

        public decimal TotalGeralReceitas { get; set; }

        public decimal TotalGeralDespesas { get; set; }

        public decimal SaldoGeral => TotalGeralReceitas - TotalGeralDespesas;
    }
}