using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.DTOs.Banco
{
    public class CriarBancoDto
    {
        [Required]
        [MaxLength(100)]
        public string Nome { get; set; } = string.Empty;

        [Required]
        public int Tipo { get; set; }
    }
}
