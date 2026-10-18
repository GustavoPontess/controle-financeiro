namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// A parte VARIÁVEL da renda que a pessoa espera num mês (comissão, bico, diária…). A parte fixa vem das
/// contas fixas de receita; o recebido vem dos lançamentos. Uma linha por mês; sem linha, vale a do último mês
/// que tem (a pessoa muda quando quiser). Dado pessoal: só o dono lê e escreve; a família vê pelas regras de
/// <see cref="MembroFamilia.VisibilidadeRenda"/>. Spec: docs/features/familia/renda-e-visibilidade.md §2.2.
/// </summary>
public class RendaPrevista
{
    public Guid Id { get; set; }
    public Guid UsuarioId { get; set; }
    public int Ano { get; set; }
    public int Mes { get; set; }

    /// <summary>Quanto a pessoa espera receber de renda variável no mês (0 = não espera nada além do fixo).</summary>
    public decimal VariavelEsperada { get; set; }

    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
}
