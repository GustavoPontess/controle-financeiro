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
  /** Perna do Pix no Crédito (entrada do cartão ou o Pix que ela pagou): entra no saldo, não é
   *  receita/despesa. Só pra mostrar — a confirmação detecta de novo no servidor. */
  pixNoCredito?: boolean
  /** "Pagamento de fatura" que vai quitar a fatura do app que fecha nessa data (rótulo de Cartões);
   *  null = fica como despesa (fatura de antes do app). Só pra mostrar — o servidor decide de novo. */
  pagaFaturaFechamento?: string | null
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
}

export interface LinhaImportar {
  data: string
  descricao: string
  valor: number
  tipo: TipoTransacaoImport
  fitId: string | null
  categoriaId: string | null
}

export interface ResultadoImportacao {
  importadas: number
  /** Linhas puladas porque já estavam na conta (mesmo código do banco). */
  jaExistiam?: number
  /** A mesma confirmação já tinha sido feita: nada foi gravado de novo. */
  repetido?: boolean
}
