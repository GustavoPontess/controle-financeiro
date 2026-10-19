namespace ControleFinanceiro.Api.DTOs.DinheiroDoMes;

/// <summary>Um pedaço do que já saiu no mês (uma categoria, ou "Outras" juntando as menores).</summary>
public record ParteDoMesDto(Guid? CategoriaId, string Nome, decimal Valor, decimal PercentualDaRenda);

/// <summary>Uma conta que ainda vai sair no mês. <c>ContaFixaId</c>: a conta fixa de onde veio (pra pausar ou cancelar).</summary>
public record AindaVemDto(Guid TransacaoId, Guid? ContaFixaId, string Descricao, DateOnly Data, Guid? CategoriaId, string Categoria, decimal Valor);

/// <summary>
/// Uma fatura a pagar no mês (o lado do caixa: as compras dela já contaram como gasto quando foram feitas).
/// <c>Atrasada</c>: venceu antes deste mês e ficou algo por pagar.
/// </summary>
public record FaturaDoMesDto(Guid FaturaId, Guid CartaoId, string Cartao, DateTime DataInicio, DateTime DataFechamento,
    DateTime DataVencimento, decimal Total, decimal Pago, decimal Restante, bool Atrasada);

/// <summary>O que dá pra fazer a partir da resposta: rótulo do botão e a rota do app.</summary>
public record AcaoDto(string Rotulo, string Para);

/// <summary>A resposta em uma frase, com o tom ("positivo" · "alerta" · "negativo" · "neutro") e as ações.</summary>
public record RespostaDto(string Tom, string Texto, List<AcaoDto> Acoes);

/// <summary>
/// O dinheiro do mês da pessoa (docs/features/respostas/visao.md): a renda como total da barra e o que está comendo
/// ela. <c>RendaBase</c> = o maior entre o esperado (declarado na Renda) e o recebido. <c>Livre</c> = base − o que
/// já saiu − o que ainda vem (negativo = passa da renda). Fato (<c>JaSaiu</c>) e previsto (<c>AindaVem</c>) separados.
/// <c>Faturas</c>: as faturas de cartão a pagar no mês (quando o dinheiro sai da conta); ficam FORA do gasto e do
/// livre, porque as compras delas já contaram no mês em que foram feitas.
/// </summary>
public record DinheiroDoMesDto(
    int Ano,
    int Mes,
    decimal RendaEsperada,
    decimal RendaRecebida,
    decimal RendaBase,
    decimal JaSaiu,
    decimal AindaVemTotal,
    decimal Livre,
    decimal PercentualUsado,
    List<ParteDoMesDto> JaSaiuPorCategoria,
    List<AindaVemDto> AindaVem,
    RespostaDto Resposta,
    List<FaturaDoMesDto> Faturas,
    decimal FaturasAPagar);
