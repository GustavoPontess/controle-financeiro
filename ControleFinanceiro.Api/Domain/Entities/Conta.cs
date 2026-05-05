using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

public class Conta
{
    public Guid Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Nome { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? NumeroConta { get; set; }

    [Required]
    public TipoConta Tipo { get; set; }

    public TipoCartao? TipoCartao { get; set; }

    public bool IsCarteira { get; set; }

    public Guid? BancoId { get; set; }
    public Banco? Banco { get; set; }

    public Guid UsuarioIdProprietario { get; set; }
    public Usuario? UsuarioProprietario { get; set; }

    public ICollection<Transacao> Transacoes { get; set; } = new List<Transacao>();
    public ICollection<CompartilhamentoConta> CompartilhamentosContas { get; set; } = new List<CompartilhamentoConta>();
}
