namespace ControleFinanceiro.Api.Domain.Enums;

/// <summary>
/// O que a família vê da renda de um membro. Quem decide é a própria pessoa (nem o admin muda).
/// Spec: docs/features/familia/renda-e-visibilidade.md §2.3.
/// </summary>
public enum VisibilidadeRenda
{
    /// <summary>Nada: nem o peso. No rateio proporcional a pessoa entra como "não informou" (parte igual).</summary>
    Nada = 0,

    /// <summary>Só o peso (padrão): a família usa a renda prevista no rateio proporcional, mas ninguém vê o valor.</summary>
    SoPeso = 1,

    /// <summary>O valor aparece só pra quem a pessoa marcou (<c>MembroFamilia.RendaVisivelPara</c>).</summary>
    ValorParaAlguns = 2,

    /// <summary>O valor aparece pra todo membro com permissão Membro ou Admin (quem só vê nunca vê renda).</summary>
    ValorParaTodos = 3,
}
