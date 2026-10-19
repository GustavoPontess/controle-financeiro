// O dinheiro do mês da pessoa (GET /dinheiro-do-mes): a renda como total da barra e o que está comendo ela.

export interface ParteDoMes {
  /** null = "Sem categoria" ou "Outras" (as menores juntas). */
  categoriaId: string | null
  nome: string
  valor: number
  percentualDaRenda: number
}

export interface AindaVem {
  transacaoId: string
  /** A conta fixa de onde veio (pra pausar ou cancelar); null = lançamento previsto avulso. */
  contaFixaId: string | null
  descricao: string
  /** "YYYY-MM-DD" */
  data: string
  categoriaId: string | null
  categoria: string
  valor: number
}

/** Fatura de cartão a pagar no mês: o lado do caixa (as compras dela já contaram como gasto quando foram feitas). */
export interface FaturaDoMes {
  faturaId: string
  cartaoId: string
  cartao: string
  /** Período das compras (ISO). */
  dataInicio: string
  dataFechamento: string
  dataVencimento: string
  total: number
  pago: number
  restante: number
  /** Venceu antes deste mês e ficou algo por pagar. */
  atrasada: boolean
}

/** Parcelas já compradas (ainda não pagas) que caem nos próximos meses. */
export interface ParcelasFuturas {
  total: number
  ateAno: number | null
  ateMes: number | null
  porMes: { ano: number; mes: number; valor: number }[]
}

export interface AcaoResposta {
  rotulo: string
  /** Rota do app. */
  para: string
}

export interface RespostaDoMes {
  tom: "positivo" | "alerta" | "negativo" | "neutro"
  texto: string
  acoes: AcaoResposta[]
}

export interface DinheiroDoMes {
  ano: number
  mes: number
  rendaEsperada: number
  rendaRecebida: number
  /** O maior entre o esperado e o recebido: o total da barra. */
  rendaBase: number
  jaSaiu: number
  aindaVemTotal: number
  /** Base − já saiu − ainda vem; negativo = passa da renda. */
  livre: number
  percentualUsado: number
  jaSaiuPorCategoria: ParteDoMes[]
  aindaVem: AindaVem[]
  resposta: RespostaDoMes
  /** Faturas a pagar no mês: fora do gasto e do livre (as compras já contaram quando foram feitas). */
  faturas: FaturaDoMes[]
  faturasAPagar: number
  /** O que já está comprometido nos próximos meses com compras parceladas (não come a renda deste mês). */
  parcelasFuturas: ParcelasFuturas
}
