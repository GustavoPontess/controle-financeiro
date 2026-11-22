export type TipoTransacaoImport = 1 | 2 // 1 = Despesa, 2 = Receita

export interface ExtratoLinha {
  data: string
  descricao: string
  valor: number
  tipo: TipoTransacaoImport
  fitId: string | null
  duplicada: boolean
  categoriaSugeridaId: string | null
  categoriaSugeridaNome: string | null
  /** A ENTRADA do Pix no Crédito (o cartão pondo o valor na conta): entra no saldo, não é receita. Só registro.
   *  Só pra mostrar — a confirmação detecta de novo no servidor. */
  pixNoCredito?: boolean
  /** O Pix que o cartão pagou (Pix no crédito): é o gasto, com categoria como qualquer outro. */
  pagoNoCredito?: boolean
  /** Pix no crédito: a posição, na lista, da outra perna (a entrada aponta pro Pix que ela pagou e o Pix pra entrada). */
  parPixNoCredito?: number | null
  /** "Pagamento de fatura" que vai quitar a fatura do app que fecha nessa data (rótulo de Cartões);
   *  null = a fatura não está no app, fica só o registro. Só pra mostrar — o servidor decide de novo. */
  pagaFaturaFechamento?: string | null
  /** O que o sinal não diz: pagamento de fatura e entre suas contas (só registro, sem categoria), empréstimo (tem
   *  categoria, fora da renda e do gasto) ou investimento (vem com uma categoria de investimento). */
  natureza?: "pagamento-fatura" | "entre-contas" | "emprestimo" | "investimento" | null
  /** Entre suas contas: a conta da outra perna, quando ela já está no app (as duas viram uma transferência). */
  juntaComConta?: string | null
  /** Quem está do outro lado ("iFood", "Fulana Exemplo…"). Null no que não é ganho nem gasto. */
  estabelecimento?: string | null
  /** O grupo: a mesma chave = o mesmo lugar (a tela categoriza o grupo de uma vez). */
  chave?: string | null
  /** De onde veio a categoria: o que a pessoa já escolheu, o histórico, o que outras pessoas escolheram pro mesmo
   *  lugar, o óbvio ou o nome. Regra e coletivo são fortes (a fila de revisão pula); o resto a pessoa confere. */
  sugestaoDe?: "regra" | "historico" | "coletivo" | "conhecido" | "nome" | null
  /** Com vários arquivos: de qual veio. */
  arquivo?: string | null
  /** Forma de pagamento que o texto do banco diz (enum MeioPagamento); null = não diz. */
  meioSugerido?: number | null
  /** A descrição lida pelo servidor (2026-11-21): os pedaços em ordem (juntos dão a descrição), cada um o tipo do
   *  movimento, o nome ou o resto (data, documento, conta…). */
  pedacos?: PedacoDescricao[] | null
  /** O tipo do movimento pelo texto do banco ("Pix", "Débito", "Boleto"…). */
  tipoMovimento?: string | null
  /** CPF (só os 6 do meio) ou CNPJ de quem está do outro lado. */
  documento?: string | null
}

export interface PedacoDescricao {
  texto: string
  parte: "tipo" | "nome" | "resto"
}

export interface ArquivoLido {
  nome: string
  linhas: number
  /** Por que ficou de fora (o resto segue). */
  erro?: string | null
}

/** Qual coluna (índice, a partir de 0) do CSV é o quê. Valor numa coluna OU entrada + saída. */
export interface MapeamentoCsv {
  data: number
  descricao: number
  valor: number | null
  entrada: number | null
  saida: number | null
  id: number | null
  inverterSinal: boolean
  /** Coluna com o tipo do lançamento ("Pix enviado"), quando o banco separa tipo e nome. */
  tipo?: number | null
}

export interface PreviewImportacao {
  linhas: ExtratoLinha[]
  total: number
  duplicadas: number
  formato?: "ofx" | "csv"
  /** CSV que não deu pra reconhecer: a tela pergunta qual coluna é o quê e lê de novo. */
  precisaMapear?: boolean
  colunas?: string[] | null
  /** Até 5 linhas do arquivo, como estão. */
  amostra?: string[][] | null
  /** O mapeamento usado (ou a sugestão parcial). */
  mapeamento?: MapeamentoCsv | null
  assinatura?: string | null
  /** As colunas vieram do que a pessoa já escolheu nessa conta. */
  mapeamentoLembrado?: boolean
  /** Leitura com vários arquivos: cada um, com as linhas ou o motivo de ter ficado de fora. */
  arquivos?: ArquivoLido[] | null
  /** Por que cada coluna do CSV é o que é ("pelo nome da coluna", "pelo conteúdo", "lembrado desta conta"…). */
  motivos?: string[] | null
}

export interface LinhaImportar {
  data: string
  descricao: string
  valor: number
  tipo: TipoTransacaoImport
  fitId: string | null
  categoriaId: string | null
  /** Separado do lugar na prévia: a categoria vale só pra ele, não vira regra do lugar. */
  naoLembrar?: boolean
  /** O que a pessoa conferiu na ficha (data, valor, tipo e `descricao` são os do banco). Vazio = o do banco. */
  descricaoEditada?: string | null
  subcategoriaId?: string | null
  meioPagamento?: number | null
  /** "HH:MM:00" ou null. */
  hora?: string | null
  /** "Usar onde estou" (o servidor confere e arredonda). Os dois juntos ou nenhum. */
  latitude?: number | null
  longitude?: number | null
}

/** Uma importação já feita (lista "Importações anteriores"): a conta, de que dia a que dia iam os lançamentos que
 *  entraram ("2026-03-01"), quantos foram e quando a pessoa confirmou (instante do servidor). */
export interface ImportacaoAnterior {
  id: string
  contaId: string
  contaNome: string
  criadoEm: string
  de: string
  ate: string
  quantidade: number
}

export interface ResultadoImportacao {
  importadas: number
  /** Linhas puladas porque já estavam na conta (mesmo código do banco). */
  jaExistiam?: number
  /** A mesma confirmação já tinha sido feita: nada foi gravado de novo. */
  repetido?: boolean
  /** O lançamento criado por cada linha enviada, na ordem (null = pulada ou pagamento de fatura). */
  ids?: (string | null)[]
}

/** Fila de pendentes: um lançamento que já está na conta e ficou sem categoria (GET /importacao/pendentes). */
export interface Pendente {
  id: string
  /** AAAA-MM-DD */
  data: string
  hora?: string | null
  descricao: string
  valor: number
  tipo: number
  /** A conta ou o cartão do lançamento. */
  origem: string
  meioPagamento?: number | null
  /** O lugar lido da descrição e a chave dele (junta os lançamentos do mesmo lugar). */
  lugar: string
  chave: string
  categoriaSugeridaId?: string | null
  categoriaSugeridaNome?: string | null
  pedacos?: PedacoDescricao[] | null
  /** "Usar onde estou": o ponto que o lançamento já tem. */
  latitude?: number | null
  longitude?: number | null
}
/** O que a pessoa acertou num lançamento da fila, junto com a categoria. Campo ausente = não mexe. */
export interface AjustePendente { transacaoId: string; descricao?: string; hora?: string; meioPagamento?: number }
export interface Pendentes { total: number; itens: Pendente[] }
