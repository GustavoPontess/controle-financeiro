using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Arquivo que a pessoa anexou a um lançamento (print da nota, foto do cupom, PDF do comprovante). 2026-11-07.
/// Só o dono do lançamento vê e mexe (o mesmo que edita: <c>AnexoTransacaoService</c>). Foto é SEMPRE a imagem
/// redesenhada pelo servidor (WebP, sem EXIF/GPS); PDF é guardado como veio, depois de conferido pelo conteúdo, e
/// só sai como download. Some com o lançamento e com a pessoa (cascade), entra na exportação LGPD.
/// </summary>
public class AnexoTransacao
{
    public Guid Id { get; set; }

    public Guid TransacaoId { get; set; }
    public Transacao? Transacao { get; set; }

    /// <summary>Dono do lançamento (pra cota por pessoa, exportação e purga sem passar pela transação).</summary>
    public Guid UsuarioId { get; set; }

    /// <summary>Nome que a pessoa deu ao arquivo (limpo: sem caminho nem caractere de controle).</summary>
    [Required]
    [MaxLength(120)]
    public string Nome { get; set; } = string.Empty;

    /// <summary>"image/webp" ou "application/pdf" (decidido pelo servidor, nunca pelo que o cliente disse).</summary>
    [Required]
    [MaxLength(40)]
    public string TipoConteudo { get; set; } = "image/webp";

    public int Tamanho { get; set; }

    [Required]
    public byte[] Dados { get; set; } = [];

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}
