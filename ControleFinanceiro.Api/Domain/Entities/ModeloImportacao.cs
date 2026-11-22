using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// O que a pessoa disse sobre as colunas de um CSV de extrato, lembrado por conta e por cabeçalho
/// (<see cref="Assinatura"/>): na próxima importação do mesmo banco o arquivo entra direto, sem perguntar.
/// Não é dado financeiro (só índices de coluna): some junto com a conta.
/// </summary>
public class ModeloImportacao
{
    public const int AssinaturaMaxLength = 300;

    public Guid Id { get; set; }
    public Guid UsuarioId { get; set; }
    public Guid ContaId { get; set; }

    /// <summary>Cabeçalho normalizado ("data|descricao|valor") ou "sem-cabecalho:N".</summary>
    [Required]
    [MaxLength(AssinaturaMaxLength)]
    public string Assinatura { get; set; } = string.Empty;

    public int ColunaData { get; set; }
    public int ColunaDescricao { get; set; }
    public int? ColunaValor { get; set; }
    public int? ColunaEntrada { get; set; }
    public int? ColunaSaida { get; set; }
    public int? ColunaId { get; set; }
    /// <summary>Coluna com o tipo do lançamento, quando o banco separa tipo e nome (2026-11-21).</summary>
    public int? ColunaTipo { get; set; }
    public bool InverterSinal { get; set; }

    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
}
