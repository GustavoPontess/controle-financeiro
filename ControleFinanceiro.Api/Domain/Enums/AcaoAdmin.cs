namespace ControleFinanceiro.Api.Domain.Enums;

/// <summary>
/// Ação de admin registrada no <c>AdminAuditLog</c> (Módulo D — spec `docs/features/admin/spec.md` §6).
/// Valores inteiros são persistidos — NÃO reordenar nem reaproveitar números.
/// </summary>
public enum AcaoAdmin
{
    AprovarCadastro = 0,
    RecusarCadastro = 1,
    BloquearUsuario = 2,
    ReativarUsuario = 3,
    ForcarResetSenha = 4,

    // ── Módulo C — LGPD (spec §5) ──
    ExportarDados = 5,
    MarcarExclusao = 6,
    CancelarExclusao = 7,
    PurgarUsuario = 8,
}
