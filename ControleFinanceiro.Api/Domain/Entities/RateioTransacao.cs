using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>A parte de um membro numa despesa dividida, GRAVADA na hora de dividir (decisão do Gustavo, 2026-10-19:
/// "se eu mudar a regra, as antigas não podem mudar"). Existe em todo modo (Igual, Pela renda, Do meu jeito); o modo
/// fica em <c>Transacao.ModoRateio</c> só como "como chegou nesses números". Mudar a regra da família vale pras
/// próximas; quem saiu da família continua nas despesas em que estava. Spec: docs/features/familia/espaco-da-familia.md.</summary>
public class RateioTransacao
{
    public Guid Id { get; set; }

    public Guid TransacaoId { get; set; }
    public Transacao? Transacao { get; set; }

    public Guid UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }

    /// <summary>Percentual da despesa atribuído ao membro (0–100). A soma dos
    /// itens de uma transação é 100.</summary>
    [Range(0, 100)]
    public decimal Percentual { get; set; }

    /// <summary>A parte em reais, já com o resto dos centavos acertado (a soma dos itens é o valor da despesa).</summary>
    public decimal Valor { get; set; }
}
