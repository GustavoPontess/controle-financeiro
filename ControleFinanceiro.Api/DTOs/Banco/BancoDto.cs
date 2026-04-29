namespace ControleFinanceiro.Api.DTOs.Banco
{
    public class BancoDto
    {
        public Guid Id { get; set; }
        public string Nome { get; set; } = string.Empty;
        public string NomeFantasia { get; set; } = string.Empty;
        public string RazaoSocial { get; set; } = string.Empty;
        public string? CodigoBanco { get; set; }
        public int Tipo { get; set; }
        public string TipoDescricao { get; set; } = string.Empty;
        public bool Ativo { get; set; }
        public string? LogoUrl { get; set; }
        public string? Cor { get; set; }
    }
}
