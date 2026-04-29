using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.DTOs.Pessoa
{
    public class PessoaDto
    {
        public Guid Id { get; set; }

        [MaxLength(200)]
        public string Nome { get; set; } = string.Empty;
        
        public DateTime DataNascimento { get; set; }
        public int Idade { get; set; }
    }
}