using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Foto de perfil da pessoa (opcional). Mora numa tabela própria pra o <see cref="Usuario"/> (lido o tempo
/// todo) não arrastar os bytes; a "versão" da foto fica em <see cref="Usuario.FotoPerfilEm"/>. O que se grava
/// é SEMPRE a imagem reprocessada pelo servidor (WebP 256x256, sem EXIF), nunca o arquivo enviado.
/// Quem vê: a própria pessoa e quem está numa família ativa com ela (<c>FotoPerfilService</c>).
/// </summary>
public class FotoPerfil
{
    /// <summary>Chave e FK pro usuário (uma foto por pessoa). Cascade: some junto com a conta.</summary>
    public Guid UsuarioId { get; set; }

    [Required]
    public byte[] Dados { get; set; } = [];

    [Required]
    [MaxLength(40)]
    public string TipoConteudo { get; set; } = "image/webp";

    public DateTime AtualizadaEm { get; set; }

    public Usuario? Usuario { get; set; }
}
