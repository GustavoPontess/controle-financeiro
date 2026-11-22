using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.DTOs.Importacao;

/// <summary>Uma linha do extrato lida do arquivo, já deduplicada e com sugestão. <c>Estabelecimento</c>/<c>Chave</c>
/// (2026-11-03): quem está do outro lado e o grupo dele (a tela categoriza o grupo de uma vez); <c>SugestaoDe</c>: de
/// onde veio a categoria ("regra" = o que a pessoa já escolheu, "historico", "coletivo" = o que 3+ pessoas disseram
/// dessa loja, "conhecido", "nome").
/// <c>PixNoCredito</c>: a ENTRADA do Pix no Crédito (o cartão pondo o valor na conta) — entra no saldo, mas não é
/// receita; <c>PagoNoCredito</c>: o Pix que essa entrada pagou (gasto comum, com categoria);
/// <c>ParPixNoCredito</c>: a posição, nesta lista, da outra perna (a tela mostra a entrada junto do gasto).
/// <c>PagaFaturaFechamento</c>: "Pagamento de fatura" que vai quitar a fatura do app que fecha nessa data (o rótulo
/// da tela Cartões); null com natureza "pagamento-fatura" = a fatura não está no app, fica só o registro. A
/// confirmação decide tudo de novo no servidor (não confia na prévia). <c>Natureza</c> (2026-11-01): o que o sinal
/// não diz ("pagamento-fatura", "entre-contas", "emprestimo", "investimento"; null = comum); <c>JuntaComConta</c>: a
/// conta da outra perna que já está no app, quando é entre suas contas.</summary>
public record ExtratoLinhaDto(
    DateTime Data,
    string Descricao,
    decimal Valor,
    TipoTransacao Tipo,
    string? FitId,
    bool Duplicada,
    Guid? CategoriaSugeridaId,
    string? CategoriaSugeridaNome,
    bool PixNoCredito = false,
    DateTime? PagaFaturaFechamento = null,
    string? Natureza = null,
    string? JuntaComConta = null,
    string? Estabelecimento = null,
    string? Chave = null,
    string? SugestaoDe = null,
    string? Arquivo = null,
    bool PagoNoCredito = false,
    int? ParPixNoCredito = null,
    // Forma de pagamento que o texto do banco diz (Pix, débito, boleto, TED…); null = não diz. A tela já vem com ela.
    MeioPagamento? MeioSugerido = null,
    // A descrição lida (2026-11-21, a tela mostra o trabalho): os pedaços (tipo, nome, resto; juntos dão a descrição),
    // o tipo do movimento ("Pix", "Débito"…) e o documento de quem está do outro lado (CPF só com os 6 do meio).
    List<Services.Estabelecimento.Pedaco>? Pedacos = null,
    string? TipoMovimento = null,
    string? Documento = null);

/// <summary>Um arquivo da leitura com vários (2026-11-03): quantas linhas vieram dele, ou por que ficou de fora.</summary>
public record ArquivoLidoDto(string Nome, int Linhas, string? Erro = null);

/// <summary>
/// Resultado do parse de um extrato — nada foi salvo ainda. No CSV vem também a tabela (colunas + até 5
/// linhas de amostra), o mapeamento usado e a assinatura do cabeçalho. <c>PrecisaMapear</c>: não deu pra
/// reconhecer as colunas (ou o mapeamento não leu nada) — a tela pergunta e manda a prévia de novo com o
/// <see cref="MapeamentoCsvDto"/>. <c>MapeamentoLembrado</c>: veio do que a pessoa já escolheu nessa conta.
/// </summary>
public record PreviewImportacaoDto(
    List<ExtratoLinhaDto> Linhas,
    int Total,
    int Duplicadas,
    string Formato = "ofx",
    bool PrecisaMapear = false,
    string[]? Colunas = null,
    List<string[]>? Amostra = null,
    MapeamentoCsvDto? Mapeamento = null,
    string? Assinatura = null,
    bool MapeamentoLembrado = false,
    List<ArquivoLidoDto>? Arquivos = null,
    // Por que cada coluna é o que é (2026-11-21, a tela mostra embaixo da etiqueta): "pelo nome da coluna",
    // "pelo conteúdo", "lembrado desta conta", "você escolheu", "é o saldo" ou "não usada".
    string[]? Motivos = null);

/// <summary>Qual coluna (índice, a partir de 0) do CSV é o quê. Valor assinado OU Entrada + Saída.</summary>
public record MapeamentoCsvDto(
    [Range(0, 200)] int Data,
    [Range(0, 200)] int Descricao,
    [Range(0, 200)] int? Valor,
    [Range(0, 200)] int? Entrada,
    [Range(0, 200)] int? Saida,
    [Range(0, 200)] int? Id,
    bool InverterSinal,
    [Range(0, 200)] int? Tipo = null);

/// <summary>Uma linha aprovada pelo usuário para virar transação. Data, valor, tipo e <c>Descricao</c> são os do
/// banco (o servidor detecta fatura, Pix no crédito e entre contas por eles, e a regra do lugar nasce deles). O que a
/// pessoa confere na ficha (2026-11-05, "quase uma nova transação"): <c>DescricaoEditada</c> (o nome que fica no
/// lançamento; vazio = o do banco), <c>SubcategoriaId</c> (sempre da categoria), <c>MeioPagamento</c> (crédito não:
/// é conta) e <c>Hora</c> (opcional).</summary>
public record LinhaImportarDto(
    DateTime Data,
    [MaxLength(255)] string Descricao,
    decimal Valor,
    TipoTransacao Tipo,
    [MaxLength(255)] string? FitId,
    Guid? CategoriaId,
    // A pessoa separou esse lançamento do lugar dele na prévia: a categoria vale só pra ele e não vira regra do lugar.
    bool NaoLembrar = false,
    [MaxLength(255)] string? DescricaoEditada = null,
    Guid? SubcategoriaId = null,
    int? MeioPagamento = null,
    TimeOnly? Hora = null,
    // "Usar onde estou" na ficha (2026-11-07): o servidor confere e arredonda (AnexoTransacaoService.Ponto).
    double? Latitude = null,
    double? Longitude = null);

/// <summary>
/// Confirmação da importação: conta de destino + linhas aprovadas. Com <c>Mapeamento</c> + <c>Assinatura</c>
/// (CSV que a pessoa mapeou), o servidor lembra as colunas pra essa conta na mesma transação.
/// </summary>
public record ConfirmarImportacaoDto(
    Guid ContaId,
    List<LinhaImportarDto> Linhas,
    MapeamentoCsvDto? Mapeamento = null,
    [MaxLength(300)] string? Assinatura = null);

/// <summary>
/// Fila de pendentes (2026-11-22): um lançamento que JÁ está na conta e ficou sem categoria. Vem com o lugar lido da
/// descrição (<c>Lugar</c> e <c>Chave</c>, a mesma leitura da importação) pra tela juntar por lugar, e com a categoria
/// que o app sugere pra ele. Só o dono vê.
/// </summary>
public record PendenteDto(
    Guid Id,
    DateOnly Data,
    TimeOnly? Hora,
    string Descricao,
    decimal Valor,
    TipoTransacao Tipo,
    // De onde saiu ou onde entrou: o nome da conta, ou do cartão.
    string Origem,
    MeioPagamento? MeioPagamento,
    string Lugar,
    string Chave,
    Guid? CategoriaSugeridaId,
    string? CategoriaSugeridaNome,
    List<Services.Estabelecimento.Pedaco>? Pedacos = null,
    // "Usar onde estou": o ponto que o lançamento já tem (só o dono recebe a fila).
    double? Latitude = null,
    double? Longitude = null);

/// <summary>A fila: quantos pendentes a pessoa tem ao todo e os mais recentes (até <c>ImportacaoService.MaximoPendentes</c>).</summary>
public record PendentesDto(int Total, List<PendenteDto> Itens);

/// <summary>
/// Dá uma categoria (e, se quiser, a subcategoria dela) a um ou mais lançamentos pendentes de uma vez: os de um lugar.
/// <c>Lembrar</c>: a escolha vira a regra do lugar (a próxima importação já sugere).
/// </summary>
public record CategorizarPendentesDto(
    [Required, MinLength(1), MaxLength(500)] List<Guid> TransacaoIds,
    Guid CategoriaId,
    Guid? SubcategoriaId = null,
    bool Lembrar = true,
    // O que a pessoa acertou em cada lançamento ali mesmo (a ficha da fila tem os mesmos campos da transação).
    [MaxLength(500)] List<AjustePendenteDto>? Ajustes = null);

/// <summary>
/// O que muda num lançamento junto com a categoria: a descrição, a hora e a forma de pagamento. Campo nulo = não mexe.
/// Valor, data e conta não entram aqui (isso é editar a transação).
/// </summary>
public record AjustePendenteDto(
    Guid TransacaoId,
    [MaxLength(255)] string? Descricao = null,
    TimeOnly? Hora = null,
    int? MeioPagamento = null);

public record CategorizarPendentesResultadoDto(int Categorizados, int Restam);

/// <summary>"Foi pagamento de cartão": saídas da conta, pendentes, que pagaram a fatura de um cartão (o banco escreveu
/// de um jeito que o app não reconheceu). Viram registro de pagamento de fatura, sem categoria.</summary>
public record PagamentoDeCartaoDto([Required, MinLength(1), MaxLength(500)] List<Guid> TransacaoIds);

/// <summary>Uma importação já feita, pra lista "Importações anteriores": a conta, de que dia a que dia iam os
/// lançamentos que entraram, quantos foram e quando a pessoa confirmou (instante UTC).</summary>
public record ImportacaoAnteriorDto(Guid Id, Guid ContaId, string ContaNome, DateTime CriadoEm, DateOnly De, DateOnly Ate, int Quantidade);

/// <summary>
/// Resultado da confirmação. <c>JaExistiam</c>: linhas com FITID que já está na conta (o servidor pula, mesmo
/// que a prévia tenha mandado). <c>Repetido</c>: a mesma confirmação já tinha sido feita (Idempotency-Key) —
/// nada foi gravado de novo.
/// </summary>
/// <c>Ids</c>: o lançamento criado por cada linha, na ordem das linhas (null = pulada, ou pagamento de fatura): o front
/// manda os anexos da ficha pra eles depois. Vazio quando <c>Repetido</c>.
public record ResultadoImportacaoDto(int Importadas, int JaExistiam = 0, bool Repetido = false, List<Guid?>? Ids = null);

/// <summary>Ensinar o nome (2026-11-21): a descrição como o banco escreveu e as palavras dela que são o nome (seguidas).</summary>
public record EnsinarNomeDto(
    [Required][MaxLength(500)] string Descricao,
    [Required][MaxLength(300)] string Nome);

/// <summary>O nome que a descrição dá agora, com o padrão aprendido.</summary>
public record EnsinarNomeResultadoDto(string Nome);
