using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Registro de idempotência de uma operação transacional: "o usuário X já executou a operação Y
/// com a chave Z, e o resultado foi o registro <see cref="ReferenciaId"/>".
///
/// Existe pra substituir (por enquanto só no pagamento de fatura) o padrão antigo de procurar a
/// idempotencyKey com LIKE dentro do JSON do FinancialEventLog — que era lento, limitado a uma
/// janela de 24h e, principalmente, NÃO atômico: duas requisições simultâneas com a mesma chave
/// passavam as duas pela consulta antes de qualquer uma gravar. Aqui quem garante a unicidade é o
/// índice ÚNICO (UsuarioId, Operacao, Chave) no banco: o registro é gravado no MESMO SaveChanges da
/// operação, então a segunda requisição concorrente estoura o índice e vira replay.
///
/// Vínculo com o usuário via FK com cascade: a chave não tem valor de auditoria (quem audita é o
/// FinancialEventLog), então some junto na purga LGPD da conta.
/// </summary>
public class RegistroIdempotencia
{
    public const int OperacaoMaxLength = 50;
    public const int ChaveMaxLength = 100;

    public Guid Id { get; set; }

    /// <summary>Dono da chave. A chave só é única dentro do usuário (dois usuários podem gerar a mesma).</summary>
    public Guid UsuarioId { get; set; }

    /// <summary>Nome da operação ("PagarFatura"). Separa o espaço de chaves por fluxo.</summary>
    [Required]
    [MaxLength(OperacaoMaxLength)]
    public string Operacao { get; set; } = string.Empty;

    /// <summary>Valor do header Idempotency-Key enviado pelo cliente (UUID gerado no front).</summary>
    [Required]
    [MaxLength(ChaveMaxLength)]
    public string Chave { get; set; } = string.Empty;

    /// <summary>Registro produzido pela operação original (ex.: a Transacao de pagamento), pra o
    /// replay devolver o mesmo resultado. Guid solto (sem FK) — o registro de origem tem soft delete
    /// próprio e não pode ficar preso a esta tabela.</summary>
    public Guid? ReferenciaId { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}
