namespace ControleFinanceiro.Api.DTOs.Conta
{
    /// <summary>
    /// Encerrar a conta (fechada no banco). Com saldo zero, nada a informar. Com saldo, diga o que
    /// aconteceu com o dinheiro — UM dos dois: <see cref="ContaDestinoId"/> (o saldo foi pra outra conta:
    /// vira uma transferência de verdade) ou <see cref="Ajustar"/> (no banco já está zerado: vira um
    /// ajuste, como na reconciliação).
    /// </summary>
    public class EncerrarContaDto
    {
        public Guid? ContaDestinoId { get; set; }
        public bool Ajustar { get; set; }
        /// <summary>Dia do encerramento (da transferência ou do ajuste). Omitido = hoje. Não pode ser futuro.</summary>
        public DateOnly? Data { get; set; }
    }

    public class EncerramentoContaDto
    {
        public Guid ContaId { get; set; }
        public DateTime EncerradaEm { get; set; }
        /// <summary>"zerada" | "transferencia" | "ajuste"</summary>
        public string Resolucao { get; set; } = string.Empty;
        public decimal SaldoAntes { get; set; }
    }
}
