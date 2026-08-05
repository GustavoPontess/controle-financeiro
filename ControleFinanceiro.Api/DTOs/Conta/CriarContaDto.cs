using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.DTOs.Conta
{
    public class CriarContaDto
    {
        [Required]
        [MaxLength(100)]
        public string Nome { get; set; } = string.Empty;

        [MaxLength(50)]
        public string? NumeroConta { get; set; }

        [MaxLength(10)]
        public string? Agencia { get; set; }

        [Required]
        public int Tipo { get; set; }

        public int? TipoCartao { get; set; }

        public decimal SaldoInicial { get; set; }
        public Guid? BancoId { get; set; }
    }
}
