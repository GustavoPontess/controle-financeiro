using ControleFinanceiro.Api.Domain.Enums;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Forma de pagamento num lugar só: o rótulo (era copiado em 4 telas/relatórios) e a leitura do número que vem
/// do cliente (antes gravava qualquer número).
/// </summary>
public class MeioPagamentoExtensionsTests
{
    [Theory]
    [InlineData(1, MeioPagamento.Dinheiro)]
    [InlineData(6, MeioPagamento.Boleto)]
    [InlineData(7, MeioPagamento.DebitoAutomatico)]
    public void DoCliente_ValorDoEnum_Converte(int valor, MeioPagamento esperado)
        => Assert.Equal(esperado, MeioPagamentoExtensions.DoCliente(valor));

    [Fact]
    public void DoCliente_Null_SegueNull() => Assert.Null(MeioPagamentoExtensions.DoCliente(null));

    [Theory]
    [InlineData(0)]
    [InlineData(8)]
    [InlineData(99)]
    [InlineData(-1)]
    public void DoCliente_ForaDoEnum_Recusa(int valor)
    {
        var ex = Assert.Throws<ArgumentException>(() => MeioPagamentoExtensions.DoCliente(valor));
        Assert.Equal(MeioPagamentoExtensions.MensagemInvalido, ex.Message);
    }

    [Fact]
    public void Descricao_TodoValorDoEnumTemRotulo()
    {
        foreach (var meio in Enum.GetValues<MeioPagamento>())
            Assert.False(string.IsNullOrWhiteSpace(((MeioPagamento?)meio).Descricao()), $"{meio} sem rótulo");
        Assert.Equal("Débito automático", ((MeioPagamento?)MeioPagamento.DebitoAutomatico).Descricao());
        Assert.Null(((MeioPagamento?)null).Descricao());
    }
}
