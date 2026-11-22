using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// "Sempre que vier daqui, é esta categoria" (2026-11-03, categorizar por grupo na importação): aprendida sozinha
/// quando a pessoa importa um extrato com a categoria escolhida pra um estabelecimento (<see cref="Services.Estabelecimento"/>).
/// A próxima importação já sugere. Uma por pessoa e chave; a escolha mais nova vale. Guarda nome de estabelecimento
/// ou de pessoa (Pix): entra na exportação LGPD e some com a conta (cascade).
/// </summary>
public class RegraCategoria
{
    public Guid Id { get; set; }
    public Guid UsuarioId { get; set; }

    /// <summary>"d:" ou "r:" + o nome simplificado (ver <see cref="Services.Estabelecimento.Chave"/>).</summary>
    [Required]
    [MaxLength(Services.Estabelecimento.ChaveMaxLength)]
    public string Chave { get; set; } = string.Empty;

    /// <summary>O nome como apareceu no extrato, pra mostrar.</summary>
    [Required]
    [MaxLength(255)]
    public string Nome { get; set; } = string.Empty;

    public TipoTransacao Tipo { get; set; }
    public Guid CategoriaId { get; set; }

    /// <summary>
    /// Pode contar pra sugestão coletiva (2026-11-04)? Só quando o lançamento era COMPRA em loja (cartão) e a categoria
    /// é padrão: aí, quando 3 ou mais pessoas diferentes dão a mesma categoria ao mesmo estabelecimento, ela vira
    /// sugestão pra todo mundo. O que sai pros outros é só "estabelecimento → categoria", agregado, sem quem disse.
    /// Pix, TED, boleto e débito automático ficam sempre false: do outro lado pode estar uma pessoa (dado pessoal).
    /// </summary>
    public bool Compartilhavel { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
}
