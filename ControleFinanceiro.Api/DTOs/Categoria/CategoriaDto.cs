using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.DTOs.Categoria
{
    public class CategoriaDto
    {
        public Guid Id { get; set; }

        [MaxLength(400)]
        public string Descricao { get; set; } = string.Empty;

        public int Finalidade { get; set; }
    }
}