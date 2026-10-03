namespace ControleFinanceiro.Api.DTOs.Reconciliacao;

/// <summary>Cria um marco de reconciliação. Idempotência via header Idempotency-Key.</summary>
public class CriarMarcoReconciliacaoDto
{
    public Guid ContaId { get; set; }

    /// <summary>Data+hora do ponto conferido (o front manda ISO com a hora escolhida).</summary>
    public DateTime DataHora { get; set; }

    /// <summary>Saldo REAL informado pelo usuário (extrato do banco). Obrigatório: ausente → 400.
    /// Nullable de propósito — sem isso um campo omitido virava 0 e o ajuste lançava o saldo inteiro.
    /// Zero explícito continua válido (conta zerada de verdade).</summary>
    public decimal? SaldoDeclarado { get; set; }

    /// <summary>1 = Baseline (assume o declarado como verdade, sempre ajusta a diferença);
    /// 2 = Verificacao (padrão — confere; só ajusta se Resolucao = "ajustar").</summary>
    public int Tipo { get; set; } = 2;

    /// <summary>Como fechar a diferença numa verificação: "ajustar" cria um lançamento de ajuste;
    /// qualquer outro valor (ou vazio) não cria nada — o usuário lança o que falta manualmente.
    /// Ignorado em baseline (que sempre ajusta).</summary>
    public string? Resolucao { get; set; }

    public string? Observacao { get; set; }
}
