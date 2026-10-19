namespace ControleFinanceiro.Api.Domain.Enums;

/// <summary>
/// Tipo da conta. Pra criar/editar em Bancos valem <see cref="ContaCorrente"/>, <see cref="ContaPoupanca"/>,
/// <see cref="Dinheiro"/> (a carteira padrão nasce assim; a pessoa pode ter outras — cofrinho, caixa de casa) e
/// <see cref="Investimento"/> (corretora, CDB, Tesouro). <see cref="CartaoCredito"/> e <see cref="Emprestimo"/>
/// são legado: cartão e empréstimo têm entidade própria — <see cref="Services.ContaService"/> recusa.
/// <see cref="Caixinha"/> é a conta de uma meta (criada junto com ela, como as caixinhas do Nubank): o dinheiro
/// guardado na meta mora nela. Só Metas mexe (guardar/resgatar); Bancos mostra mas não edita, encerra nem exclui.
/// </summary>
public enum TipoConta
{
    ContaCorrente = 1,
    ContaPoupanca = 2,
    CartaoCredito = 3,
    Dinheiro = 4,
    Emprestimo = 5,
    Investimento = 6,
    Caixinha = 7
}
