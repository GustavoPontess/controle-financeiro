/** "ok" · "perto" (passou do alerta, 80%) · "passou" (gastou mais que o limite). */
export type SituacaoLimite = "ok" | "perto" | "passou"

/** Um limite que vale no mês (vale todo mês até a pessoa mudar). `categoriaId` null = todos os gastos. */
export interface LimiteDoMes {
  categoriaId: string | null
  categoria: string
  limite: number
  /** Efetivado no mês (inclui a parcela do mês das compras parceladas). */
  gasto: number
  /** Conta fixa da categoria que ainda vai cair no mês. */
  previsto: number
  /** Negativa = quanto passou. */
  sobra: number
  percentual: number
  situacao: SituacaoLimite
  /** De quando vale este valor. */
  desdeAno: number
  desdeMes: number
}

export interface GastoSemLimite {
  categoriaId: string | null
  categoria: string
  gasto: number
}

export interface LimitesDoMes {
  ano: number
  mes: number
  /** Mês atual ou futuro: dá pra pôr, mudar e tirar. Mês passado fica como estava. */
  editavel: boolean
  totalLimite: number
  totalGasto: number
  totalPrevisto: number
  limites: LimiteDoMes[]
  semLimite: GastoSemLimite[]
}
