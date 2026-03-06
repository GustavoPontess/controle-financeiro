namespace ControleFinanceiro.Api.DTOs.Transacao
{
    public class TransacaoDto
    {
        public Guid Id { get; set; }
        public string Descricao { get; set; } = string.Empty;
        public decimal Valor { get; set; }
        public int Tipo { get; set; }
        public Guid CategoriaId { get; set; }
        public Guid PessoaId { get; set; }
    }
}