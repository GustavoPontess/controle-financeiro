namespace ControleFinanceiro.Api.Domain.Enums;

/// <summary>
/// Situação da conta no ciclo de vida do beta/produção. Fonte ÚNICA da verdade sobre "esta conta
/// pode usar o sistema?" — substituiu o antigo <c>bool Ativo</c> (removido na migration
/// <c>AddStatusUsuario</c>, 2026-09-09) pra não ter dois campos respondendo a mesma pergunta.
/// Só <see cref="Ativo"/> loga; qualquer outro estado barra no login/refresh/reset.
/// Ver <c>docs/features/admin/spec.md</c> §2-§3.
/// </summary>
/// <remarks>
/// Os valores inteiros são persistidos no banco — <b>não reordenar nem reaproveitar números</b>.
/// A migration de dados mapeia o antigo <c>Ativo</c>: true → <see cref="Ativo"/> (1),
/// false → <see cref="Bloqueado"/> (3).
/// </remarks>
public enum StatusUsuario
{
    /// <summary>Cadastro feito, esperando o admin aprovar. NÃO loga. Todo cadastro novo nasce aqui.</summary>
    AguardandoAprovacao = 0,

    /// <summary>Aprovado — usa o sistema normalmente. Único estado que permite login.</summary>
    Ativo = 1,

    /// <summary>Admin recusou o cadastro. NÃO loga. Terminal (não reverte pela fila).</summary>
    Recusado = 2,

    /// <summary>Conta suspensa pelo admin (reversível). NÃO loga; dados preservados. Módulo B.</summary>
    Bloqueado = 3,

    /// <summary>Marcada para exclusão (LGPD) — em carência antes do hard delete. NÃO loga. Módulo C.</summary>
    MarcadoParaExclusao = 4,

    /// <summary>"Membro que saiu": quem ficou no lugar de uma conta EXCLUÍDA no histórico da família (só os números
    /// das despesas divididas e do dinheiro entre eles; ver <c>FamiliaAoExcluirConta</c>). Sem e-mail real, sem senha.
    /// NUNCA loga e não aparece no admin.</summary>
    Removido = 5,
}
