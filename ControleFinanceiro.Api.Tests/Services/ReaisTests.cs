using System.Globalization;
using ControleFinanceiro.Api.Services;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>Valor em reais nas mensagens, igual em qualquer máquina (a produção roda com cultura invariante).</summary>
public class ReaisTests
{
    [Theory]
    [InlineData(1234.56, "R$ 1.234,56")]
    [InlineData(0, "R$ 0,00")]
    [InlineData(-10, "-R$ 10,00")]
    [InlineData(1234567.891, "R$ 1.234.567,89")]
    public void Formatar_NoPadraoBrasileiro(double valor, string esperado) =>
        Assert.Equal(esperado, Reais.Formatar((decimal)valor));

    [Fact]
    public void Formatar_NaoDependeDaCulturaDaMaquina()
    {
        var antes = CultureInfo.CurrentCulture;
        try
        {
            CultureInfo.CurrentCulture = CultureInfo.InvariantCulture; // como na imagem alpine
            Assert.Equal("R$ 1.000,00", Reais.Formatar(1000m));
        }
        finally { CultureInfo.CurrentCulture = antes; }
    }
}
