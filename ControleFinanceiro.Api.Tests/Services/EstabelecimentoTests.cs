using ControleFinanceiro.Api.Services;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>Quem está do outro lado do lançamento (2026-11-03): descrições no formato da Nubank e do Inter, com nomes
/// inventados. Desde 2026-11-21 as regras são genéricas (<see cref="Estabelecimento.Ler"/>).</summary>
public class EstabelecimentoTests
{
    [Theory]
    [InlineData("Compra no débito - MP *PHLANCHESLTDA", "MP *PHLANCHESLTDA")]
    [InlineData("Compra no débito via NuPay - iFood", "iFood")]
    [InlineData("Estorno - Compra no débito via NuPay - iFood", "iFood")]
    [InlineData("Transferência enviada pelo Pix - Fulana de Tal Souza - •••.321.654-•• - BANCO INTER (0077) Agência: 1 Conta: 12345678-9", "Fulana de Tal Souza")]
    [InlineData("Transferência recebida pelo Pix - UBER DO BRASIL TECNOLOGIA LTDA - 17.895.646/0001-87 - Banco Citibank S.A. (0745) Agência: 1 Conta: 33334444-5", "UBER DO BRASIL TECNOLOGIA LTDA")]
    [InlineData("Transferência Recebida - Swile - 26.401.688/0001-05 - SWAP IP S.A. (0783) Agência: 1 Conta: 55555-5", "Swile")]
    [InlineData("Pix enviado: \"Cp :18236120-Beltrano Dias de Lima\"", "Beltrano Dias de Lima")]
    [InlineData("Pix recebido: \"00019 17156092 ACME SOLUCOES DIGITAIS LTDA\"", "ACME SOLUCOES DIGITAIS LTDA")]
    [InlineData("Deb Pag Seguro Pix: \"Seguro Pix/Plano Standard\"", "Seguro Pix/Plano Standard")]
    [InlineData("Pagamento de fatura", "Pagamento de fatura")]
    [InlineData("Compra no débito - 99* 99InAppPaymentCapt", "99* 99InAppPaymentCapt")]
    public void Nome_TiraOQueOExtratoPoeEmVolta(string descricao, string esperado) =>
        Assert.Equal(esperado, Estabelecimento.Nome(descricao));

    [Fact]
    public void Chave_OMesmoLugarEscritoDeJeitosDiferentesEUmGrupoSo()
    {
        var a = Estabelecimento.Chave("Transferência recebida pelo Pix - UBER DO BRASIL TECNOLOGIA LTDA - 17.895.646/0001-87 - Banco Citibank S.A. (0745) Agência: 1 Conta: 33334444-5", false);
        var b = Estabelecimento.Chave("Transferência recebida pelo Pix - UBER DO BRASIL TECNOLOGIA LTDA . - 17.895.646/0001-87 - Banco Citibank S.A. (0745) Agência: 1 Conta: 11112222-3", false);
        Assert.Equal(a, b);
        Assert.Equal("r:uber do brasil tecnologia", a);

        var fulana1 = Estabelecimento.Chave("Transferência enviada pelo Pix - Fulana de Tal Souza - •••.321.654-•• - BANCO INTER (0077) Agência: 1 Conta: 12345678-9", true);
        var fulana2 = Estabelecimento.Chave("Transferência enviada pelo Pix - FULANA DE TAL SOUZA - •••.321.654-•• - MERCADO PAGO IP LTDA. (0323) Agência: 1 Conta: 9876543210-0", true);
        Assert.Equal(fulana1, fulana2);
    }

    [Fact]
    public void Chave_PixQueVoceMandouEPixQueRecebeuSaoGruposDiferentes() =>
        Assert.NotEqual(
            Estabelecimento.Chave("Transferência enviada pelo Pix - Ciclano Prado - •••.047.067-•• - NU PAGAMENTOS - IP (0260)", true),
            Estabelecimento.Chave("Transferência Recebida - Ciclano Prado - •••.047.067-•• - NU PAGAMENTOS - IP (0260)", false));

    [Theory]
    [InlineData("Compra no débito via NuPay - iFood", true, "Alimentação")]
    [InlineData("Compra no débito - SUPERMERCADOS BH", true, "Alimentação")]
    [InlineData("Compra no débito - POSTO ABASTECA AQUI BA", true, "Transporte")]
    [InlineData("Transferência enviada pelo Pix - UBER DO BRASIL TECNOLOGIA LTDA. - 17.895.646/0001-87 - ADYEN", true, "Transporte")]
    [InlineData("Compra no débito - DROGARIA ARAUJO", true, "Saúde e bem-estar")]
    [InlineData("Compra no débito - MERCADO LIVRE", true, "Compras")]
    [InlineData("Deb Pag Seguro Pix: \"Seguro Pix/Plano Standard\"", true, "Seguros")]
    [InlineData("Recebimento de proventos: \"PAGAMENTO DE PROVENTOS ACME SOLUCOES DIGITAIS LTDA\"", false, "Renda")]
    [InlineData("Transferência enviada pelo Pix - Joana Exemplo - •••.321.654-••", true, null)] // pessoa: ninguém adivinha
    [InlineData("Compra no débito - MP *PHLANCHESLTDA", true, null)]
    // Ampliado em 2026-11-04 com o extrato de 10 meses: o tipo do lugar, nunca o nome da pessoa.
    [InlineData("Compra no débito - MP *SODRESSORVETE", true, null)] // nome colado: "sodressorvete" não é a palavra "sorvete"
    [InlineData("Compra no débito - KC GRILL", true, "Alimentação")]
    [InlineData("Compra no débito - VIA ESPETOS", true, "Alimentação")]
    [InlineData("Compra no débito - Burguesia", true, "Alimentação")]
    [InlineData("Compra no débito - CABELOS BEER", true, "Alimentação")]
    [InlineData("Compra no débito - SUP EPA SETE", true, "Alimentação")]
    [InlineData("Compra no débito - DITAO CIMENTO", true, "Moradia")]
    [InlineData("Compra no débito - CASA ELETRICA", true, "Moradia")]
    [InlineData("Compra no débito - PARK SAO FRANCISCO", true, "Transporte")]
    [InlineData("Compra no débito - 60553295Lecione", true, null)] // número colado no nome: não é a palavra "lecione"
    [InlineData("Compra no débito - ZIG*LAB", true, "Lazer e entretenimento")]
    [InlineData("Compra no débito - DROGASIL3535", true, null)] // número colado no nome: não é a palavra
    [InlineData("Pagamento de fatura", true, "Outros")] // sem o cartão cadastrado: saiu dinheiro, mas não é gasto com nome
    [InlineData("Estorno - Ajuste de compra no débito - 99Food *Tropeiro do Ch", false, "Dinheiro que volta")]
    [InlineData("Transferência enviada pelo Pix - Cakes da Maria - •••.321.654-••", true, "Alimentação")] // "cakes" é palavra inteira
    public void CategoriaConhecida_SoOObvio(string descricao, bool despesa, string? esperada) =>
        Assert.Equal(esperada, Estabelecimento.CategoriaConhecida(Estabelecimento.Chave(descricao, despesa)));

    // Só compra em loja (cartão) pode virar sugestão coletiva: do outro lado de um Pix pode estar uma pessoa.
    [Theory]
    [InlineData("Compra no débito - MP *PHLANCHESLTDA", true)]
    [InlineData("Compra no débito via NuPay - iFood", true)]
    [InlineData("Compra no crédito - SUPERMERCADOS BH", true)]
    [InlineData("Estorno - Ajuste de compra no débito - 99Food *Tropeiro do Ch", true)]
    [InlineData("Transferência enviada pelo Pix - Fulana de Tal Souza - •••.321.654-••", false)]
    [InlineData("Pix enviado: \"Cp :18236120-Beltrano Dias de Lima\"", false)]
    [InlineData("Pagamento de boleto efetuado - CEMIG", false)]
    [InlineData("Débito automático - UNIMED", false)]
    [InlineData("Pagamento de fatura", false)]
    public void EhCompra_SoCartao(string descricao, bool esperado) =>
        Assert.Equal(esperado, Estabelecimento.EhCompra(descricao));

    // ── Regras genéricas (2026-11-21) ────────────────────────────────────────────────────────────────────
    // Descrições montadas pra cobrir cada regra (nomes inventados). Não afirmam o formato de um banco: os exemplos por
    // banco entram com extrato de verdade ou fonte confiável.

    [Theory]
    [InlineData("PIX ENVIADO MARIA EXEMPLO CPF ***.123.456-** AG 0001 CC 12345-6", "MARIA EXEMPLO", "Pix", "CPF •••.123.456-••")]
    [InlineData("PIX RECEBIDO JOAO P EXEMPLO 03/11 14:22", "JOAO P EXEMPLO", "Pix", null)]
    [InlineData("COMPRA CARTAO DEB MERCADO BOM PRECO 04/11", "MERCADO BOM PRECO", "Débito", null)]
    [InlineData("COMPRA CARTAO CRED LOJA EXEMPLO 12/03", "LOJA EXEMPLO", "Crédito", null)]
    [InlineData("PAGTO BOLETO ENERGIA CIDADE", "ENERGIA CIDADE", "Boleto", null)]
    [InlineData("TED RECEBIDA 341 0412 98765-4 CONSTRUTORA ALVORADA LTDA 12.345.678/0001-90", "CONSTRUTORA ALVORADA LTDA", "Transferência", "CNPJ 12.345.678/0001-90")]
    [InlineData("TRANSF ENVIADA P/ FULANO EXEMPLO 05/11/2026", "FULANO EXEMPLO", "Transferência", null)]
    [InlineData("DEBITO AUTOMATICO PLANO SAUDE EXEMPLO", "PLANO SAUDE EXEMPLO", "Débito automático", null)]
    [InlineData("Pix enviado: \"Cp :18236120-Beltrano Dias de Lima\"", "Beltrano Dias de Lima", "Pix", null)]
    [InlineData("Transferência enviada pelo Pix - Fulana de Tal Souza - •••.321.654-•• - BANCO EXEMPLO (0077) Agência: 1 Conta: 12345678-9", "Fulana de Tal Souza", "Pix", "CPF •••.321.654-••")]
    [InlineData("Deb Pag Seguro Pix: \"Seguro Pix/Plano Standard\"", "Seguro Pix/Plano Standard", "Pagamento", null)]
    [InlineData("Compra no débito - 99* 99InAppPaymentCapt", "99* 99InAppPaymentCapt", "Débito", null)]
    [InlineData("TARIFA", "TARIFA", null, null)]
    public void Ler_TipoNomeEDocumentoSemFraseDeBanco(string descricao, string nome, string? tipo, string? documento)
    {
        var l = Estabelecimento.Ler(descricao);
        Assert.Equal(nome, l.Nome);
        Assert.Equal(tipo, l.Tipo);
        Assert.Equal(documento, l.Documento);
        // Os pedaços juntos são a descrição de volta (a tela mostra o original inteiro, com o nome destacado).
        Assert.Equal(descricao, string.Concat(l.Pedacos.Select(p => p.Texto)));
        Assert.Equal(nome, string.Concat(l.Pedacos.Where(p => p.Parte == "nome").Select(p => p.Texto)).Trim(' ', '-', '.', '"'));
    }

    [Fact]
    public void Ler_CpfSemMascaraSaiMascarado() =>
        Assert.Equal("CPF •••.456.789-••", Estabelecimento.Ler("PIX ENVIADO FULANO EXEMPLO 123.456.789-01").Documento);

    [Fact]
    public void Chave_DataEHoraNaDescricaoNaoSeparamOMesmoLugar() =>
        Assert.Equal(
            Estabelecimento.Chave("PIX RECEBIDO JOAO P EXEMPLO 03/11 14:22", false),
            Estabelecimento.Chave("PIX RECEBIDO JOAO P EXEMPLO 21/11 08:05", false));

    // Ensinar o nome (2026-11-21): guarda só a FORMA do que vem antes e depois, nunca as palavras da pessoa.
    [Fact]
    public void PadraoDe_GuardaSoAFormaENaoONome()
    {
        var p = Estabelecimento.PadraoDe("XPTO REC 341 0412 98765-4 CONSTRUTORA ALVORADA LTDA 12.345.678/0001-90", "CONSTRUTORA ALVORADA LTDA");
        Assert.NotNull(p);
        Assert.Equal(new[] { "W", "rec", "#", "#", "#" }, p!.Antes);
        Assert.Equal("DOC", p.Depois);
        Assert.DoesNotContain(p.Antes, a => a.Contains("CONSTRUTORA", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Ler_ComPadraoEnsinado_AchaONomeEmOutraDescricaoDaMesmaForma()
    {
        var p = Estabelecimento.PadraoDe("XPTO REC 341 0412 98765-4 CONSTRUTORA ALVORADA LTDA 12.345.678/0001-90", "CONSTRUTORA ALVORADA LTDA")!;
        var l = Estabelecimento.Ler("XPTO REC 237 0099 11223-0 PADARIA BOM DIA ME 98.765.432/0001-10", [p]);
        Assert.Equal("PADARIA BOM DIA ME", l.Nome);
        // Sem o padrão, o leitor genérico decide sozinho (aqui não sabe que XPTO REC é o tipo).
        Assert.NotEqual("PADARIA BOM DIA ME", Estabelecimento.Ler("XPTO REC 237 0099 11223-0 PADARIA BOM DIA ME 98.765.432/0001-10").Nome);
    }

    [Fact]
    public void Ler_PadraoQueNaoCasa_SegueOLeitorGenerico()
    {
        var p = Estabelecimento.PadraoDe("XPTO REC 341 0412 98765-4 CONSTRUTORA ALVORADA LTDA 12.345.678/0001-90", "CONSTRUTORA ALVORADA LTDA")!;
        Assert.Equal("MERCADO CENTRAL", Estabelecimento.Ler("PIX ENVIADO MERCADO CENTRAL", [p]).Nome);
    }

    [Fact]
    public void PadraoDe_NomeNoComecoOuForaDaDescricao_Null()
    {
        Assert.Null(Estabelecimento.PadraoDe("MERCADO CENTRAL 03/11", "MERCADO CENTRAL"));
        Assert.Null(Estabelecimento.PadraoDe("PIX ENVIADO MERCADO CENTRAL", "PADARIA"));
    }

    [Fact]
    public void Chave_ComPadrao_JuntaOMesmoLugarComCodigosDiferentes() =>
        Assert.Equal(
            Estabelecimento.Chave("XPTO REC 341 0412 98765-4 CONSTRUTORA ALVORADA LTDA 12.345.678/0001-90", false,
                [Estabelecimento.PadraoDe("XPTO REC 341 0412 98765-4 CONSTRUTORA ALVORADA LTDA 12.345.678/0001-90", "CONSTRUTORA ALVORADA LTDA")!]),
            Estabelecimento.Chave("XPTO REC 001 7777 55555-1 CONSTRUTORA ALVORADA LTDA 12.345.678/0001-90", false,
                [Estabelecimento.PadraoDe("XPTO REC 341 0412 98765-4 CONSTRUTORA ALVORADA LTDA 12.345.678/0001-90", "CONSTRUTORA ALVORADA LTDA")!]));

    // Termos padronizados pela Febraban desde 08/07/2024 (saque e depósito; citados no blog do Santander e na imprensa,
    // tabela "Padronização das literais dos extratos bancários" no portal da Febraban). Não têm nome de lugar nem de
    // pessoa: o termo inteiro é o lugar, pra cada operação virar um grupo só.
    [Theory]
    [InlineData("SAQUE DIN CARTAO AG")]
    [InlineData("SAQUE BANCO 24H")]
    [InlineData("DEP CHEQUE ATM")]
    [InlineData("DEP DINHEIRO BCO 24H")]
    [InlineData("DEP CHEQUE BCO 24H")]
    [InlineData("PIX SAQUE")]
    [InlineData("PIX TROCO")]
    public void Ler_TermosPadronizadosDaFebraban_OTermoInteiroEhOLugar(string descricao) =>
        Assert.Equal(descricao, Estabelecimento.Ler(descricao).Nome);
}
