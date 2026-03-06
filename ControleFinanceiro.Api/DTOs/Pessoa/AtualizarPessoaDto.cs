using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.DTOs.Pessoa
{
    public class AtualizarPessoaDto
    {
        [MaxLength(200)]
        public string Nome { get; set; } = string.Empty;
        
        public int Idade { get; set; }
    }
}