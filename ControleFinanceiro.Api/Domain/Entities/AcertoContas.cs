using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>Dinheiro que passou de um membro pra outro pra equilibrar o mês da família (Issue #26; passo 3 do espaço
/// da família, 2026-10-19). Quem passou registra → espera quem recebeu confirmar (só aí entra no equilíbrio); quem
/// recebeu registra → já vale. Cada lado pode ter o seu lançamento na conta (fora do resultado, <c>EhAcerto</c>).</summary>
public class AcertoContas
{
    public Guid Id { get; set; }

    public Guid FamiliaId { get; set; }
    public Familia? Familia { get; set; }

    /// <summary>Quem pagou (devedor).</summary>
    public Guid DeUsuarioId { get; set; }
    public Usuario? DeUsuario { get; set; }

    /// <summary>Quem recebeu (credor).</summary>
    public Guid ParaUsuarioId { get; set; }
    public Usuario? ParaUsuario { get; set; }

    [Range(0.01, double.MaxValue)]
    public decimal Valor { get; set; }

    public int Mes { get; set; }
    public int Ano { get; set; }

    [MaxLength(400)]
    public string? Observacao { get; set; }

    public Guid CriadoPor { get; set; }

    /// <summary>Dia em que o dinheiro passou (o dos lançamentos).</summary>
    public DateOnly? Data { get; set; }

    /// <summary>Quando quem recebeu confirmou (ou registrou). Null = esperando confirmar: fora do equilíbrio.</summary>
    public DateTime? ConfirmadoEm { get; set; }

    /// <summary>A saída na conta de quem passou (null = não lançou em conta).</summary>
    public Guid? TransacaoSaidaId { get; set; }
    public Transacao? TransacaoSaida { get; set; }

    /// <summary>A entrada na conta de quem recebeu (null = não lançou em conta).</summary>
    public Guid? TransacaoEntradaId { get; set; }
    public Transacao? TransacaoEntrada { get; set; }

    /// <summary>xmin: confirmar/lançar duas vezes ao mesmo tempo → a segunda dá 409 (não cria dois lançamentos).</summary>
    public uint Versao { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    /// <summary>Soft delete: cancelar o acerto preserva o histórico.</summary>
    public bool Ativo { get; set; } = true;
}
