using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.DTOs.Transferencia;

public class CriarTransferenciaDto
{
    public Guid ContaOrigemId { get; set; }
    public Guid ContaDestinoId { get; set; }
    public decimal Valor { get; set; }
    /// <summary>Dia da transferência ("yyyy-MM-dd") — date puro, sem fuso. Não pode ser futuro.</summary>
    public DateOnly Data { get; set; }
    /// <summary>Hora ("HH:mm:ss") — time puro, sem fuso; vai pras duas pernas. Null = sem hora.</summary>
    public TimeOnly? Hora { get; set; }

    [MaxLength(255)]
    public string Descricao { get; set; } = string.Empty;
}

/// <summary>"Isso foi entre minhas contas": a outra conta da transferência.</summary>
public class LancamentoViraTransferenciaDto
{
    public Guid OutraContaId { get; set; }
}

public class TransferenciaDto
{
    public Guid Id { get; set; }
    public Guid ContaOrigemId { get; set; }
    public string ContaOrigemNome { get; set; } = string.Empty;
    public Guid ContaDestinoId { get; set; }
    public string ContaDestinoNome { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public DateTime Data { get; set; }
    public string Descricao { get; set; } = string.Empty;
    /// <summary>Uma das contas é caixinha de meta: guardar/resgatar, que só se mexe pela tela de Metas (não se edita aqui).</summary>
    public bool ComCaixinha { get; set; }
}
