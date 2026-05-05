using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

public class Categoria
{
    public Guid Id { get; set; }

    [Required]
    [MaxLength(400)]
    public string Descricao { get; set; } = string.Empty;

    [Required]
    public Finalidade Finalidade { get; set; }

    // null = padrão (todos veem, ninguém deleta); guid = categoria pessoal do usuário
    public Guid? UsuarioId { get; set; }
}