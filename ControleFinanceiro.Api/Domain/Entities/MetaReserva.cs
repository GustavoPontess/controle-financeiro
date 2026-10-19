namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Parte do saldo de uma conta reservada pra uma meta (modelo do Monarch, decisão do Gustavo em 2026-10-19).
/// O dinheiro NÃO sai da conta: a reserva só marca quanto daquele saldo já tem destino. Uma linha por meta e
/// conta (guardar soma, tirar subtrai; zerou, a linha sai). Livre de uma conta = saldo − Σ reservas dela.
/// Progresso da meta = Σ reservas dela. Sem lançamento, sem dinheiro inventado.
/// </summary>
public class MetaReserva
{
    public Guid Id { get; set; }
    public Guid MetaId { get; set; }
    public Guid ContaId { get; set; }

    /// <summary>Dono da conta (quem reservou). Numa meta de família, cada um reserva das próprias contas.</summary>
    public Guid UsuarioId { get; set; }

    public decimal Valor { get; set; }
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;

    public Meta? Meta { get; set; }
    public Conta? Conta { get; set; }
}
