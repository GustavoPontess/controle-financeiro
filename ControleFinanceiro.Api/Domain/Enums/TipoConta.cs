namespace ControleFinanceiro.Api.Domain.Enums;

/// <summary>
/// Tipo da conta. Pra criar/editar em Bancos valem <see cref="ContaCorrente"/>, <see cref="ContaPoupanca"/>,
/// <see cref="Dinheiro"/> (a carteira padrão nasce assim; a pessoa pode ter outras — cofrinho, caixa de casa) e
/// <see cref="Investimento"/> (corretora, CDB, Tesouro). <see cref="CartaoCredito"/> e <see cref="Emprestimo"/>
/// são legado: cartão e empréstimo têm entidade própria — <see cref="Services.ContaService"/> recusa.
/// </summary>
public enum TipoConta
{
    ContaCorrente = 1,
    ContaPoupanca = 2,
    CartaoCredito = 3,
    Dinheiro = 4,
    Emprestimo = 5,
    Investimento = 6
}
