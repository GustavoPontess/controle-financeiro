import type { RespostaDoMes } from "./DinheiroDoMes"

/** Uma meta em andamento no orçamento: quanto pede por mês pra chegar no prazo e quanto entrou nela no mês. */
export interface MetaDoOrcamento {
  id: string
  nome: string
  icone: string
  porMes: number
  guardadoNoMes: number
  falta: number
}

/** O orçamento do mês (base zero): a renda esperada distribuída entre as despesas planejadas e as metas. */
export interface OrcamentoDoMes {
  ano: number
  mes: number
  rendaEsperada: number
  rendaRecebida: number
  despesasPlanejadas: number
  despesasGastas: number
  praGuardar: number
  guardadoNoMes: number
  metas: MetaDoOrcamento[]
  /** Renda esperada − planejado − o que as metas pedem. Zero: toda a renda tem destino; negativo: passou. */
  aAlocar: number
  resposta: RespostaDoMes
}
