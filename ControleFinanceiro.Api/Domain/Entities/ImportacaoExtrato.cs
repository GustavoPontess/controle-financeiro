namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Uma importação de extrato que a pessoa confirmou (2026-11-05, "importações anteriores" na primeira tela de
/// Importar extrato): em que conta, de que dia a que dia iam os lançamentos que entraram, quantos foram e quando.
/// Responde "até onde eu já importei?". É só o registro: os lançamentos são <see cref="Transacao"/> comuns (nada
/// aponta pra cá) e apagar um lançamento depois não muda a linha. Gravada na mesma transação da confirmação
/// (<c>ImportacaoService.ConfirmarAsync</c>); a confirmação repetida (Idempotency-Key) não grava outra. Some com a
/// conta e com a pessoa; sai na exportação LGPD.
/// </summary>
public class ImportacaoExtrato
{
    public Guid Id { get; set; }
    public Guid UsuarioId { get; set; }
    public Guid ContaId { get; set; }

    /// <summary>Quando a pessoa confirmou (instante, UTC).</summary>
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    /// <summary>O dia do lançamento mais antigo que entrou.</summary>
    public DateOnly De { get; set; }
    /// <summary>O dia do lançamento mais novo que entrou.</summary>
    public DateOnly Ate { get; set; }

    /// <summary>Quantos lançamentos entraram (o que já estava na conta e foi pulado não conta).</summary>
    public int Quantidade { get; set; }
}
