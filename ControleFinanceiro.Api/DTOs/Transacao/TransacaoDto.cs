namespace ControleFinanceiro.Api.DTOs.Transacao
{
    public class TransacaoDto
    {
        public Guid Id { get; set; }
        public string Descricao { get; set; } = string.Empty;
        public decimal Valor { get; set; }
        public int Tipo { get; set; }
        public Guid? CategoriaId { get; set; }
        public Guid? SubcategoriaId { get; set; }
        public Guid? ContaId { get; set; }
        public string? ContaNome { get; set; }
        public Guid? CartaoCreditoId { get; set; }
        public string? CartaoCreditoNome { get; set; }
        public bool UsadoComoCredito { get; set; }
        public int? MeioPagamento { get; set; }
        public string? MeioPagamentoDescricao { get; set; }
        public Guid? FaturaId { get; set; }
        // Origem do lançamento — front rotula a natureza na lista
        // (recorrente / parcelado / pagamento de fatura).
        public Guid? RecorrenteOrigemId { get; set; }
        public Guid? ParcelamentoId { get; set; }
        public Guid? ParcelaTransacaoId { get; set; }
        public bool EhPagamentoFatura { get; set; }
        // Perna de transferência entre contas próprias — no extrato aparece
        // neutra (não conta como entrada/saída, só troca de bolso).
        public bool EhTransferencia { get; set; }
        // 0 = Previsao, 1 = Executado, 2 = Cancelado.
        public int StatusTransacao { get; set; }
        /// <summary>Dia do lançamento ("yyyy-MM-dd") — date puro, sem fuso.</summary>
        public DateOnly Data { get; set; }
        /// <summary>Hora do lançamento ("HH:mm:ss") — time puro, sem fuso. Null = sem hora.</summary>
        public TimeOnly? Hora { get; set; }
    }
}