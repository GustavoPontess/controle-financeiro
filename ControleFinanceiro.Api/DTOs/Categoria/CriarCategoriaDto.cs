using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.DTOs.Categoria
{
    public class CriarCategoriaDto
    {
        [MaxLength(400)]
        public string Descricao { get; set; } = string.Empty;
        public int Finalidade { get; set; }
    }
}