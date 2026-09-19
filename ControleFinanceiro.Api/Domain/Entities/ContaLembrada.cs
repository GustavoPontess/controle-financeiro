namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Roster / "escolher conta" (estilo Google, mas OPT-IN). Uma conta entra aqui só quando o login
/// vem com "manter-me conectado" marcado — nunca automático. Amarra a conta a um NAVEGADOR (cookie
/// opaco de dispositivo `rd`; aqui fica só o hash). Depois do logout, a conta aparece no chooser
/// pré-login: a pessoa seleciona e digita a senha (nunca loga sozinha — nenhum token sobrevive ao
/// logout). Minimização: NÃO duplica PII — nome/e-mail vêm de um join em <see cref="Usuario"/> na
/// hora de exibir (e o e-mail é mascarado). Sai por: remover da lista, esquecer todas, ou a conta
/// ser marcada pra exclusão.
/// </summary>
public class ContaLembrada
{
    public Guid Id { get; set; }

    /// <summary>Hash SHA-256 (hex) do device id opaco (cookie `rd`). Identifica o navegador; o bruto
    /// vive só no cookie httpOnly.</summary>
    public string DeviceHash { get; set; } = string.Empty;

    public Guid UsuarioId { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime UltimoUsoEm { get; set; } = DateTime.UtcNow;

    // Nav
    public Usuario Usuario { get; set; } = null!;
}
