using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.DTOs.Emprestimo;

/// <summary>Credor propõe juntar 2+ empréstimos ativos que tem com a mesma contraparte vinculada
/// num plano novo. Mesmos campos de forma de pagamento de CriarEmprestimoDto — nada muda nos
/// empréstimos originais até o devedor aceitar.</summary>
public class ProporConsolidacaoDto
{
    public List<Guid> EmprestimoIds { get; set; } = new();

    [MaxLength(255)]
    public string Descricao { get; set; } = string.Empty;
    public FormaPagamentoEmprestimo FormaPagamento { get; set; } = FormaPagamentoEmprestimo.AVista;

    [Range(2, 36)]
    public int? QuantidadeParcelas { get; set; }
    public DateTime? PrimeiroVencimento { get; set; }

    /// <summary>Só usado se FormaPagamento == AVista.</summary>
    public DateTime? DataVencimento { get; set; }
    public decimal? TaxaJuroMensal { get; set; }
    public decimal? PercentualMultaAtraso { get; set; }
}

/// <summary>Devedor recusa — motivo opcional, mesmo padrão de RejeitarPagamentoEmprestimoDto.</summary>
public class RecusarConsolidacaoDto
{
    [MaxLength(1000)]
    public string? Motivo { get; set; }
}

public class EmprestimoConsolidacaoItemDto
{
    public Guid EmprestimoOriginalId { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public decimal ValorRestanteSnapshot { get; set; }
}

public class EmprestimoConsolidacaoPropostaDto
{
    public Guid Id { get; set; }
    public Guid CredorUsuarioId { get; set; }
    public string CredorNome { get; set; } = string.Empty;
    public Guid DevedorUsuarioId { get; set; }
    public string DevedorNome { get; set; } = string.Empty;
    public string Descricao { get; set; } = string.Empty;
    public int FormaPagamento { get; set; }
    public int? QuantidadeParcelas { get; set; }
    public DateTime? PrimeiroVencimento { get; set; }
    public DateTime? DataVencimento { get; set; }
    public decimal? TaxaJuroMensal { get; set; }
    public decimal? PercentualMultaAtraso { get; set; }
    public decimal ValorTotalProposto { get; set; }
    public int Status { get; set; }
    public string StatusDescricao { get; set; } = string.Empty;
    public DateTime CriadoEm { get; set; }
    public DateTime? RespondidoEm { get; set; }
    public string? MotivoRecusa { get; set; }
    public Guid? EmprestimoConsolidadoId { get; set; }

    /// <summary>Perspectiva de quem pediu a lista — true se ele é o credor (quem propôs), false
    /// se é o devedor (quem precisa aceitar/recusar).</summary>
    public bool SouCredor { get; set; }

    public List<EmprestimoConsolidacaoItemDto> Itens { get; set; } = new();
}

/// <summary>Grupo de empréstimos que o usuário logado (como credor) poderia consolidar com uma
/// mesma contraparte vinculada — só existe pra contraparte com 2+ empréstimos ativos, não
/// quitados. Front usa isso pra oferecer "Consolidar" sem exigir seleção manual às cegas pela
/// lista inteira.</summary>
public class EmprestimoConsolidacaoCandidatoDto
{
    public Guid ContraparteUsuarioId { get; set; }
    public string ContraparteNome { get; set; } = string.Empty;
    public List<EmprestimoConsolidacaoItemDto> Itens { get; set; } = new();
}
