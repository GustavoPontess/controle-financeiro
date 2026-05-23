namespace ControleFinanceiro.Api.DTOs.Transacao
{
    public class CriarTransacaoDto
    {
        public string Descricao { get; set; } = string.Empty;
        public decimal Valor { get; set; }
        public int Tipo { get; set; }
        public Guid CategoriaId { get; set; }
        public Guid? SubcategoriaId { get; set; }
        public Guid? ContaId { get; set; }
        public Guid? CartaoCreditoId { get; set; }
        public bool UsadoComoCredito { get; set; }
        public int? MeioPagamento { get; set; }
        // Parcelamento: 1 = à vista (ou null). > 1 = gera N transações em N faturas
        public int? Parcelas { get; set; }
        public DateTime Data { get; set; }
    }
}