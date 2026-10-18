namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// O que a pessoa DECLARA esperar de renda num mês: a fixa (salário, aposentadoria, benefício) e a variável
/// (comissão, bico, diária…). Não tem nada a ver com "contas fixas" (que são contas a pagar). O recebido vem dos
/// lançamentos. Uma linha por mês; sem linha, vale a do último mês que tem (a pessoa muda quando quiser). Dado
/// pessoal: só o dono lê e escreve; a família vê pelas regras de <see cref="MembroFamilia.VisibilidadeRenda"/>.
/// Spec: docs/features/familia/renda-e-visibilidade.md §2.2.
/// </summary>
public class RendaPrevista
{
    public Guid Id { get; set; }
    public Guid UsuarioId { get; set; }
    public int Ano { get; set; }
    public int Mes { get; set; }

    /// <summary>Renda fixa que a pessoa espera no mês (salário, aposentadoria, benefício).</summary>
    public decimal FixaEsperada { get; set; }

    /// <summary>Renda variável que a pessoa espera no mês (comissão, bico, diária). 0 = nada além da fixa.</summary>
    public decimal VariavelEsperada { get; set; }

    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
}
