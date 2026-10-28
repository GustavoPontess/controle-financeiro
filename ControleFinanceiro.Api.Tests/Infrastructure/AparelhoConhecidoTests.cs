using ControleFinanceiro.Api.Infrastructure.Identity;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Cookie de aparelho conhecido (fica fora da espera do login): reconhece só a conta que entrou, não mostra o id da
/// conta, não se fabrica sem a chave do servidor, vence e guarda no máximo 5 contas.
/// </summary>
public class AparelhoConhecidoTests
{
    private static readonly DateTime Agora = new(2026, 10, 28, 15, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Reconhece_SoAContaQueEntrou()
    {
        var ana = Guid.NewGuid();
        var cookie = AparelhoConhecido.Lembrar(null, ana, Agora);

        Assert.True(AparelhoConhecido.Reconhece(cookie, ana, Agora));
        Assert.False(AparelhoConhecido.Reconhece(cookie, Guid.NewGuid(), Agora));
        Assert.DoesNotContain(ana.ToString("N"), cookie);
    }

    [Fact]
    public void Vence_DepoisDe180Dias()
    {
        var ana = Guid.NewGuid();
        var cookie = AparelhoConhecido.Lembrar(null, ana, Agora);

        Assert.True(AparelhoConhecido.Reconhece(cookie, ana, Agora.AddDays(AparelhoConhecido.Dias - 1)));
        Assert.False(AparelhoConhecido.Reconhece(cookie, ana, Agora.AddDays(AparelhoConhecido.Dias + 1)));
    }

    [Fact]
    public void EntradaMexidaOuInventada_NaoVale()
    {
        var ana = Guid.NewGuid();
        var cookie = AparelhoConhecido.Lembrar(null, ana, Agora);
        var validade = cookie.Split('.')[0];

        Assert.False(AparelhoConhecido.Reconhece($"{validade}.{new string('0', 32)}", ana, Agora));
        Assert.False(AparelhoConhecido.Reconhece("lixo", ana, Agora));
        Assert.False(AparelhoConhecido.Reconhece(new string('a', 5000), ana, Agora));
        Assert.False(AparelhoConhecido.Reconhece(null, ana, Agora));
    }

    [Fact]
    public void GuardaVariasContas_AteCinco_ESemRepetir()
    {
        var contas = Enumerable.Range(0, 6).Select(_ => Guid.NewGuid()).ToList();
        string? cookie = null;
        foreach (var c in contas) cookie = AparelhoConhecido.Lembrar(cookie, c, Agora);
        cookie = AparelhoConhecido.Lembrar(cookie, contas[^1], Agora); // a mesma de novo não duplica

        Assert.Equal(5, cookie!.Split('~').Length);
        Assert.False(AparelhoConhecido.Reconhece(cookie, contas[0], Agora)); // a mais antiga saiu
        Assert.All(contas.Skip(1), c => Assert.True(AparelhoConhecido.Reconhece(cookie, c, Agora)));
    }
}
