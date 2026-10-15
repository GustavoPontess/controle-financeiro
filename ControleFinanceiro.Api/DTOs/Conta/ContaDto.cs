namespace ControleFinanceiro.Api.DTOs.Conta
{
    public class ContaDto
    {
        public Guid Id { get; set; }
        public string Nome { get; set; } = string.Empty;
        public string? NumeroConta { get; set; }
        public string? Agencia { get; set; }
        public int Tipo { get; set; }
        public string TipoDescricao { get; set; } = string.Empty;
        public int? TipoCartao { get; set; }
        public string? TipoCartaoDescricao { get; set; }
        public decimal SaldoAtual { get; set; }
        /// <summary>Ponto de partida (lançamento EhSaldoInicial vivo). 0 = a conta começou do zero.</summary>
        public decimal SaldoInicial { get; set; }
        /// <summary>Dia do saldo inicial; null quando não há.</summary>
        public DateOnly? DataSaldoInicial { get; set; }
        public bool IsCarteira { get; set; }
        public Guid? BancoId { get; set; }
        public string BancoNome { get; set; } = string.Empty;
        public string? BancoLogoUrl { get; set; }
        public string? BancoCor { get; set; }
        /// <summary>Encerrada (fechada no banco): fora das listas, sem lançamento novo. Null = aberta.</summary>
        public DateTime? EncerradaEm { get; set; }
    }
}
