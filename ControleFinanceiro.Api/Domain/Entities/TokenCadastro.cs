namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Link do e-mail de "pedido recebido": o mesmo token serve pra "Confirmar meu e-mail" e pra "Não fui eu" (o que
/// for usado primeiro gasta o token). Guarda só o hash (SHA-256), como o de senha nova. Some com o usuário.
/// </summary>
public class TokenCadastro
{
    public Guid Id { get; set; }
    public Guid UsuarioId { get; set; }

    /// <summary>Hash do token opaco (o bruto só vai no e-mail).</summary>
    public string TokenHash { get; set; } = string.Empty;

    public DateTime ExpiraEm { get; set; }
    public bool Usado { get; set; }
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    public Usuario Usuario { get; set; } = null!;
}
