using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

public class Conta
{
    /// <summary>Recusa de qualquer escrita numa caixinha de meta fora de Metas (lançamento, conta fixa, cartão, edição).</summary>
    public const string MensagemCaixinha = "Essa é a caixinha de uma meta: guarde, resgate e edite por Metas.";

    public Guid Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Nome { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? NumeroConta { get; set; }

    [MaxLength(10)]
    public string? Agencia { get; set; }

    [Required]
    public TipoConta Tipo { get; set; }

    public TipoCartao? TipoCartao { get; set; }

    public bool IsCarteira { get; set; }

    /// <summary>
    /// Quando a conta foi encerrada (fechada no banco). Encerrada sai das listas e não recebe lançamento novo;
    /// o histórico fica. Null = aberta. Ver <c>EncerramentoContaService</c>.
    /// </summary>
    public DateTime? EncerradaEm { get; set; }

    public Guid? BancoId { get; set; }
    public Banco? Banco { get; set; }

    public Guid UsuarioIdProprietario { get; set; }
    public Usuario? UsuarioProprietario { get; set; }

    public ICollection<Transacao> Transacoes { get; set; } = new List<Transacao>();
    public ICollection<CompartilhamentoConta> CompartilhamentosContas { get; set; } = new List<CompartilhamentoConta>();
}
