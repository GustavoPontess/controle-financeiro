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
}

export interface PreviewImportacao {
  linhas: ExtratoLinha[]
  total: number
  duplicadas: number
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
}
