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
        public DateTime Data { get; set; }
    }
}