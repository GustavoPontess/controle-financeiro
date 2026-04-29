namespace ControleFinanceiro.Api.DTOs.Transacao
{
    public class CriarTransacaoDto
    {
        public string Descricao { get; set; } = string.Empty;
        public decimal Valor { get; set; }
        public int Tipo { get; set; }
        public Guid CategoriaId { get; set; }
        public Guid PessoaId { get; set; }
        public Guid? ContaId { get; set; }
        public DateTime Data { get; set; }
    }
}