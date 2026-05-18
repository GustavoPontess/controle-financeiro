using ControleFinanceiro.Api.Services;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class ExtratoImportServiceTests
{
    private readonly ExtratoImportService _svc = new();

    private const string OfxSample =
        "<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>\n" +
        "<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260510120000<TRNAMT>-50.00<FITID>ABC123<MEMO>Mercado XPTO</STMTTRN>\n" +
        "<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260512<TRNAMT>1000.00<FITID>XYZ789<NAME>Salario</STMTTRN>\n" +
        "</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>";

    [Fact]
    public void ParseOfx_LeTransacoes_ComDataValorFitIdDescricao()
    {
        var linhas = _svc.ParseOfx(OfxSample);

        Assert.Equal(2, linhas.Count);

        var debito = linhas[0];
        Assert.Equal(new DateTime(2026, 5, 10), debito.Data);
        Assert.Equal(-50.00m, debito.Valor);
        Assert.Equal("ABC123", debito.FitId);
        Assert.Equal("Mercado XPTO", debito.Descricao);

        var credito = linhas[1];
        Assert.Equal(new DateTime(2026, 5, 12), credito.Data);
        Assert.Equal(1000.00m, credito.Valor);
        Assert.Equal("Salario", credito.Descricao);
    }

    [Fact]
    public void ParseOfx_SemTransacoes_LancaArgument()
    {
        Assert.Throws<ArgumentException>(() => _svc.ParseOfx("<OFX></OFX>"));
    }

    [Fact]
    public void ParseCsv_PontoEVirgula_ComCabecalho_FormatoBR()
    {
        var csv = "Data;Histórico;Valor\n" +
                  "10/05/2026;Mercado XPTO;-50,00\n" +
                  "12/05/2026;Salário;1.000,00";

        var linhas = _svc.ParseCsv(csv);

        Assert.Equal(2, linhas.Count);
        Assert.Equal(new DateTime(2026, 5, 10), linhas[0].Data);
        Assert.Equal(-50.00m, linhas[0].Valor);
        Assert.Equal("Mercado XPTO", linhas[0].Descricao);
        Assert.Equal(1000.00m, linhas[1].Valor);
    }

    [Fact]
    public void ParseCsv_Virgula_SemCabecalho_Posicional()
    {
        var csv = "2026-05-10,Mercado,-50.00\n" +
                  "2026-05-11,Posto,-120.50";

        var linhas = _svc.ParseCsv(csv);

        Assert.Equal(2, linhas.Count);
        Assert.Equal(new DateTime(2026, 5, 10), linhas[0].Data);
        Assert.Equal(-50.00m, linhas[0].Valor);
        Assert.Equal("Posto", linhas[1].Descricao);
    }

    [Fact]
    public void ParseCsv_Vazio_LancaArgument()
    {
        Assert.Throws<ArgumentException>(() => _svc.ParseCsv(""));
    }

    [Fact]
    public void Parse_ExtensaoNaoSuportada_LancaArgument()
    {
        Assert.Throws<ArgumentException>(() => _svc.Parse("extrato.pdf", "conteudo"));
    }

    [Fact]
    public void Parse_DespachaPelaExtensao()
    {
        var linhasOfx = _svc.Parse("extrato.ofx", OfxSample);
        Assert.Equal(2, linhasOfx.Count);

        var linhasCsv = _svc.Parse("extrato.csv", "2026-05-10,Teste,-10.00");
        Assert.Single(linhasCsv);
    }
}
