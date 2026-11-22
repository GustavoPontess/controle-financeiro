using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// "Nessa descrição, o nome é isto" (2026-11-21, Importar extrato): a pessoa marcou as palavras do nome e o app guarda
/// a FORMA do que vem antes e logo depois (ver <see cref="Services.Estabelecimento.PadraoNome"/>). Não guarda o nome
/// nem nada do lançamento: só palavras de movimento ("ted", "recebida") e classes (número, data, documento, palavra).
/// É da pessoa (a forma é do banco, vale em todas as contas dela); some com ela (cascade). Uma por começo; a mais
/// nova vale.
/// </summary>
public class PadraoNomeImportacao
{
    public Guid Id { get; set; }
    public Guid UsuarioId { get; set; }

    /// <summary>As formas antes do nome, separadas por espaço ("ted recebida # # #").</summary>
    [Required]
    [MaxLength(Services.Estabelecimento.PadraoMaxLength)]
    public string Antes { get; set; } = string.Empty;

    /// <summary>A forma da primeira palavra depois do nome; null = o nome vai até o fim.</summary>
    [MaxLength(40)]
    public string? Depois { get; set; }

    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
}
