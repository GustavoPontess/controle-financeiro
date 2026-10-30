using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Anexo da solicitação (até <see cref="Services.SolicitacaoService.MaximoDeAnexos"/>): o print da tela ou a imagem do
/// bloco apontado, de qualquer tela por onde a pessoa passou. Só a imagem REDESENHADA (WebP, <see cref="Services.PrintDaTela"/>)
/// é guardada. Só o admin vê. Some 30 dias depois que a solicitação fecha (<c>PurgaPrintSolicitacaoJob</c>): pode ter valores.
/// </summary>
public class SolicitacaoAnexo
{
    public Guid Id { get; set; }

    public Guid SolicitacaoId { get; set; }
    public Solicitacao? Solicitacao { get; set; }

    /// <summary>A ordem em que a pessoa anexou (1, 2, 3…).</summary>
    public int Ordem { get; set; }

    public TipoAnexoSolicitacao Tipo { get; set; }

    /// <summary>Rota da tela de onde veio, ex. "/relatorios".</summary>
    [Required]
    [MaxLength(200)]
    public string Tela { get; set; } = string.Empty;

    /// <summary>Nome do bloco apontado (título da caixa). Null no print.</summary>
    [MaxLength(120)]
    public string? Bloco { get; set; }

    /// <summary>Texto do bloco apontado, mascarado a não ser que a pessoa tenha escolhido mostrar os valores.</summary>
    [MaxLength(500)]
    public string? TextoDoBloco { get; set; }

    /// <summary>A pessoa escolheu mandar este anexo com os valores à mostra (registro do consentimento).</summary>
    public bool MostrarValores { get; set; }

    [Required]
    public byte[] Dados { get; set; } = [];

    public int Largura { get; set; }
    public int Altura { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}
