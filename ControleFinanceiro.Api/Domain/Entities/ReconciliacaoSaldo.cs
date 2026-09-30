using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Marco de reconciliação: "nesta conta, nesta data+hora, o saldo REAL era X". Ancora a confiança no
/// saldo — sem isso o saldo é só soma de lançamentos, sem ponto de verdade. Modelo multi-marco datável:
/// reconcilia só do último marco pra frente. Ver docs/features/reconciliacao/spec.md.
///
/// O marco NÃO recalcula o saldo por conta própria — o saldo segue sendo a soma (RegrasFinanceiras).
/// Quando o declarado não bate com o calculado, quem fecha a diferença é um lançamento de ajuste
/// (Transacao.EhAjusteReconciliacao), apontado por AjusteTransacaoId. Assim a soma continua correta e
/// o marco fica como trilha de conferência.
/// </summary>
public class ReconciliacaoSaldo
{
    public Guid Id { get; set; }

    public Guid ContaId { get; set; }
    public Conta? Conta { get; set; }

    /// <summary>Dono — isolamento (multi-tenancy manual, filtrar em toda query).</summary>
    public Guid UsuarioId { get; set; }

    /// <summary>Data+hora do ponto conferido. Precisa da hora — daí a transação com hora.</summary>
    public DateTime DataHora { get; set; }

    /// <summary>Saldo REAL declarado pelo usuário (o do extrato do banco).</summary>
    public decimal SaldoDeclarado { get; set; }

    /// <summary>Saldo que o app calculou até DataHora no momento da conferência (snapshot, auditoria).</summary>
    public decimal SaldoCalculado { get; set; }

    /// <summary>Declarado − Calculado no momento da conferência (snapshot). 0 = bateu.</summary>
    public decimal Diferenca { get; set; }

    /// <summary>Baseline (1º ponto de verdade da conta) ou Verificação (confere e resolve).</summary>
    public TipoMarcoReconciliacao Tipo { get; set; }

    /// <summary>Lançamento de ajuste criado pra fechar a diferença (se houve). Null = bateu, ou o
    /// usuário resolveu lançando o que faltava manualmente.</summary>
    public Guid? AjusteTransacaoId { get; set; }
    public Transacao? AjusteTransacao { get; set; }

    [MaxLength(400)]
    public string? Observacao { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    /// <summary>Soft delete (preserva o histórico de conferências).</summary>
    public bool Ativo { get; set; } = true;
}
