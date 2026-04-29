namespace ControleFinanceiro.Api.DTOs.Conta
{
    public class ContaDto
    {
        public Guid Id { get; set; }
        public string Nome { get; set; } = string.Empty;
        public string? NumeroConta { get; set; }
        public int Tipo { get; set; }
        public string TipoDescricao { get; set; } = string.Empty;
        public int? TipoCartao { get; set; }
        public string? TipoCartaoDescricao { get; set; }
        public decimal SaldoInicial { get; set; }
        public Guid? BancoId { get; set; }
        public string BancoNome { get; set; } = string.Empty;
    }
}
