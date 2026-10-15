using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Pedaços comuns do padrão <see cref="RegistroIdempotencia"/> (índice único usuário+operação+chave, gravado no
/// MESMO SaveChanges da operação). Cada fluxo decide o que comparar no replay; aqui mora o que é igual em todos.
/// </summary>
public static class Idempotencia
{
    public const string MensagemChaveComOutrosDados =
        "Esta Idempotency-Key já foi usada com outros dados. Gere uma nova chave para um pedido diferente.";
    public const string MensagemChaveConsumida =
        "Esta Idempotency-Key já foi usada. Gere uma nova chave e tente de novo.";

    public static void ExigirTamanho(string? chave)
    {
        if (chave?.Length > RegistroIdempotencia.ChaveMaxLength)
            throw new ArgumentException(
                $"O header Idempotency-Key aceita no máximo {RegistroIdempotencia.ChaveMaxLength} caracteres.");
    }

    /// <summary>Registro gravado por (usuário, operação, chave), ou null se a chave é nova.</summary>
    public static Task<RegistroIdempotencia?> BuscarAsync(AppDbContext context, Guid usuarioId, string operacao, string chave) =>
        context.RegistrosIdempotencia
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.UsuarioId == usuarioId && r.Operacao == operacao && r.Chave == chave);

    public static RegistroIdempotencia Novo(Guid usuarioId, string operacao, string chave, Guid referenciaId) => new()
    {
        Id = Guid.NewGuid(),
        UsuarioId = usuarioId,
        Operacao = operacao,
        Chave = chave,
        ReferenciaId = referenciaId,
        CriadoEm = DateTime.UtcNow,
    };

    /// <summary>Corrida: outra requisição com a mesma chave gravou primeiro (índice único).</summary>
    public static bool EhViolacaoDeUnicidade(DbUpdateException ex) =>
        ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };
}
