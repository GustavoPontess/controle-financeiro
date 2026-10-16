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

    // ── CSV de qualquer banco (2026-10-16): tabela + mapeamento, sem "se for o banco X" ──

    [Fact]
    public void Csv_ComPreambulo_ELinhasDeSaldo_PulaOQueNaoEhLancamento()
    {
        var csv = "Extrato de conta corrente\n" +
                  "Agência: 0001;Conta: 12345-6\n" +
                  "Data Lançamento;Descrição;Valor;Saldo\n" +
                  "01/05/2026;Saldo anterior;;1.000,00\n" +
                  "02/05/2026;Padaria;-12,50;987,50\n" +
                  "03/05/2026;Pix recebido;300,00;1.287,50\n" +
                  "03/05/2026;Saldo do dia;;1.287,50\n";

        var leitura = _svc.Ler("extrato.csv", csv, null);

        Assert.False(leitura.PrecisaMapear);
        Assert.Equal(new[] { "Padaria", "Pix recebido" }, leitura.Linhas.Select(l => l.Descricao));
        Assert.Equal(new[] { -12.50m, 300m }, leitura.Linhas.Select(l => l.Valor));
        Assert.Equal("Data Lançamento", leitura.Tabela!.Colunas[0]);
    }

    [Fact]
    public void Csv_EntradaESaidaEmColunasSeparadas()
    {
        var csv = "Data;Histórico;Crédito;Débito\n" +
                  "05/05/2026;Salário;3.500,00;\n" +
                  "06/05/2026;Aluguel;;1.800,00\n";

        var linhas = _svc.ParseCsv(csv);

        Assert.Equal(new[] { 3500m, -1800m }, linhas.Select(l => l.Valor));
    }

    [Fact]
    public void Csv_ValorComDeCAoFinal_DebitoViraNegativo()
    {
        var csv = "Data;Lançamento;Valor\n" +
                  "05/05/2026;Tarifa;15,90 D\n" +
                  "06/05/2026;Depósito;200,00 C\n";

        Assert.Equal(new[] { -15.90m, 200m }, _svc.ParseCsv(csv).Select(l => l.Valor));
    }

    [Fact]
    public void Csv_DataMesDia_QuandoODiaPassaDe12_LeCerto()
    {
        var csv = "date,title,amount\n" +
                  "05/13/2026,Coffee,-4.50\n" +
                  "05/20/2026,Refund,10.00\n";

        var linhas = _svc.ParseCsv(csv);

        Assert.Equal(new DateTime(2026, 5, 13), linhas[0].Data);
        Assert.Equal(-4.50m, linhas[0].Valor);
    }

    [Fact]
    public void Csv_Identificador_ViraFitId_SoQuandoEhUnico()
    {
        var unico = "Data,Valor,Identificador,Descrição\n" +
                    "05/05/2026,-10.00,abc-1,Mercado\n" +
                    "06/05/2026,-20.00,abc-2,Farmácia\n";
        Assert.Equal(new[] { "abc-1", "abc-2" }, _svc.ParseCsv(unico).Select(l => l.FitId));

        var repetido = "Data;Documento;Histórico;Valor\n" +
                       "05/05/2026;000000;Mercado;-10,00\n" +
                       "06/05/2026;000000;Farmácia;-20,00\n";
        Assert.All(_svc.ParseCsv(repetido), l => Assert.Null(l.FitId));
    }

    [Fact]
    public void Csv_SemComoReconhecer_PedeMapeamento_EComMapeamentoLe()
    {
        // Nomes que não dizem nada e o valor dividido em duas colunas meio vazias: não dá pra confiar.
        var csv = "Dia;Texto;X;Y\n" +
                  "05/05/2026;Salário;3500,00;\n" +
                  "06/05/2026;Aluguel;;1800,00\n";

        var semMapa = _svc.Ler("extrato.csv", csv, null);
        Assert.True(semMapa.PrecisaMapear);
        Assert.Empty(semMapa.Linhas);
        Assert.Equal(new[] { "Dia", "Texto", "X", "Y" }, semMapa.Tabela!.Colunas);
        Assert.Throws<ArgumentException>(() => _svc.ParseCsv(csv));

        var mapa = new ExtratoImportService.MapeamentoCsv(Data: 0, Descricao: 1, Valor: null, Entrada: 2, Saida: 3, Id: null, InverterSinal: false);
        var comMapa = _svc.Ler("extrato.csv", csv, mapa);
        Assert.False(comMapa.PrecisaMapear);
        Assert.Equal(new[] { 3500m, -1800m }, comMapa.Linhas.Select(l => l.Valor));
    }

    [Fact]
    public void Csv_MapeamentoInvalido_Recusa()
    {
        var csv = "Data;Descrição;Valor\n05/05/2026;Mercado;-10,00\n";
        Assert.Throws<ArgumentException>(() =>
            _svc.Ler("extrato.csv", csv, new ExtratoImportService.MapeamentoCsv(0, 0, 2, null, null, null, false)));
        Assert.Throws<ArgumentException>(() =>
            _svc.Ler("extrato.csv", csv, new ExtratoImportService.MapeamentoCsv(0, 1, 9, null, null, null, false)));
    }

    [Fact]
    public void Csv_InverterSinal_ParaBancoQueMostraSaidaPositiva()
    {
        var csv = "Data;Descrição;Valor\n05/05/2026;Mercado;10,00\n";
        var linhas = _svc.Ler("extrato.csv", csv, new ExtratoImportService.MapeamentoCsv(0, 1, 2, null, null, null, true)).Linhas;
        Assert.Equal(-10m, Assert.Single(linhas).Valor);
    }

    [Fact]
    public void Csv_AssinaturaDoCabecalho_SemAcentoEMinuscula()
    {
        var t = _svc.LerTabela("Data;Histórico;Valor\n05/05/2026;Mercado;-10,00\n");
        Assert.Equal("data|historico|valor", t.Assinatura);
        Assert.True(t.TemCabecalho);
    }
}
