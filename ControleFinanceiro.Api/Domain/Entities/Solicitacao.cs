using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Pedido de melhoria ou aviso de algo errado mandado pelo selo Beta do app: título, descrição e, se a pessoa quiser,
/// anexos da tela (prints e blocos apontados, de quantas telas ela passar, até 5).
/// É dado da pessoa: entra na exportação LGPD e sai na purga (cascade do usuário).
/// </summary>
public class Solicitacao
{
    public Guid Id { get; set; }

    public Guid UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }

    public TipoSolicitacao Tipo { get; set; }

    /// <summary>O resumo, uma linha (é o que aparece na lista do Admin).</summary>
    [Required]
    [MaxLength(100)]
    public string Titulo { get; set; } = string.Empty;

    /// <summary>O detalhe, quanto a pessoa quiser escrever (opcional).</summary>
    [MaxLength(2000)]
    public string? Descricao { get; set; }

    /// <summary>Rota da tela onde a pessoa estava ao enviar (sem query string), ex. "/relatorios".</summary>
    [Required]
    [MaxLength(200)]
    public string Tela { get; set; } = string.Empty;

    /// <summary>Largura x altura da janela, ex. "390x844" (celular ou computador muda o que se vê).</summary>
    [MaxLength(20)]
    public string? Janela { get; set; }

    /// <summary>Algum anexo foi com os valores à mostra (cada anexo guarda a própria escolha).</summary>
    public bool MostrarValores { get; set; }

    /// <summary>Prints e blocos apontados (só o admin vê).</summary>
    public List<SolicitacaoAnexo> Anexos { get; set; } = [];

    public StatusSolicitacao Status { get; set; } = StatusSolicitacao.Recebida;

    /// <summary>Prioridade que o admin dá: 0 = P0 … 3 = P3. Null = ainda não triada.</summary>
    public int? Prioridade { get; set; }

    /// <summary>Anotação do admin (não aparece pra quem mandou).</summary>
    [MaxLength(1000)]
    public string? NotaAdmin { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime? AtualizadoEm { get; set; }
}
