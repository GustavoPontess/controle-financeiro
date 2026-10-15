using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

public class Recorrente
{
    public Guid Id { get; set; }

    [Required]
    [MaxLength(400)]
    public string Descricao { get; set; } = string.Empty;

    [Range(0.01, double.MaxValue)]
    public decimal Valor { get; set; }

    [Required]
    public TipoTransacao Tipo { get; set; }

    public Guid? CategoriaId { get; set; }
    public Categoria? Categoria { get; set; }

    /// <summary>Subcategoria (opcional, sempre da <see cref="CategoriaId"/>). Cada cobrança gerada herda.</summary>
    public Guid? SubcategoriaId { get; set; }
    public Subcategoria? Subcategoria { get; set; }

    /// <summary>
    /// Conta de destino. Tornado nullable: agora ContaId XOR CartaoCreditoId.
    /// Validação fica em RecorrenteService (não no domínio).
    /// </summary>
    public Guid? ContaId { get; set; }
    public Conta? Conta { get; set; }

    /// <summary>
    /// Cartão de crédito de destino (alternativa à Conta). Quando preenchido,
    /// transações geradas entram em fatura do cartão.
    /// </summary>
    public Guid? CartaoCreditoId { get; set; }
    public CartaoCredito? CartaoCredito { get; set; }

    /// <summary>Como se paga/recebe (débito automático, boleto, Pix…). Cada cobrança gerada herda. No cartão é Crédito.</summary>
    public MeioPagamento? MeioPagamento { get; set; }

    [Required]
    public FrequenciaRecorrencia Frequencia { get; set; }

    public int Dia { get; set; }

    [Required]
    public DateTime DataInicio { get; set; }

    public DateTime? DataFim { get; set; }

    public bool Ativo { get; set; } = true;

    public Guid CriadoPor { get; set; }

    public DateTime? DataProximaGeracao { get; set; }

    /// <summary>Quando foi cancelada (soft delete).</summary>
    public DateTime? CanceladoEm { get; set; }

    [MaxLength(400)]
    public string? MotivoCancelamento { get; set; }

    /// <summary>Quando foi EXCLUÍDA (exclusão lógica — some das listas, o histórico de cobranças fica).
    /// Antes excluir apagava a linha e as previsões futuras ficavam soltas e continuavam sendo cobradas.</summary>
    public DateTime? ExcluidoEm { get; set; }

    /// <summary>Quando passou pelo conserto ÚNICO de dado legado (previsões geradas no dia errado pelo motor
    /// antigo, realinhadas ao <c>Dia</c>). Null = ainda não passou — o ExpandirRecorrentesJob realinha e marca.
    /// Conta fixa criada pelo motor novo já nasce marcada (não tem o que consertar).</summary>
    public DateTime? RealinhadoEm { get; set; }

    /// <summary>Timestamp de criação (auditoria).</summary>
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    /// <summary>Token de concorrência otimista — coluna de sistema <c>xmin</c> do Postgres (igual à
    /// <c>Fatura.Versao</c>). Duas operações simultâneas na mesma conta fixa (duplo clique em Retomar/Salvar,
    /// job × requisição): a segunda afeta 0 linhas → 409, em vez de gerar as previsões 2×.</summary>
    public uint Versao { get; set; }
}
