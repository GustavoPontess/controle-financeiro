namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Meta financeira individual ou conjunta (ex.: viagem, reserva de emergência, casa).
/// O progresso é a soma das <see cref="MetaReserva"/>: parte do saldo de contas reais reservada pra meta
/// (o dinheiro não sai da conta). O antigo contador <c>ValorAtual</c> saiu (migration <c>AddMetaReserva</c>).
/// </summary>
public class Meta
{
    public Guid Id { get; set; }

    /// <summary>Nome da meta (ex.: "Viagem para Europa").</summary>
    public string Nome { get; set; } = string.Empty;

    /// <summary>Descrição opcional.</summary>
    public string? Descricao { get; set; }

    /// <summary>Valor a ser atingido.</summary>
    public decimal ValorAlvo { get; set; }

    /// <summary>Mês do prazo (dia 1), opcional.</summary>
    public DateTime? DataLimite { get; set; }

    /// <summary>Criador da meta.</summary>
    public Guid UsuarioId { get; set; }

    /// <summary>Família associada (null = meta individual).</summary>
    public Guid? FamiliaId { get; set; }

    /// <summary>Categoria vinculada para relatórios (opcional).</summary>
    public Guid? CategoriaId { get; set; }

    /// <summary>Soft delete.</summary>
    public bool Ativo { get; set; } = true;

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;

    // Navegação
    public Usuario Usuario { get; set; } = null!;
    public Familia? Familia { get; set; }
    public Categoria? Categoria { get; set; }
    public ICollection<MetaReserva> Reservas { get; set; } = new List<MetaReserva>();
}
