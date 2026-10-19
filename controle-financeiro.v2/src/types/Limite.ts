import type { AindaVem } from "./DinheiroDoMes"

/** "passou" (gastou mais que o limite) · "vai-passar" (com o que ainda vem, passa) · "perto" (do alerta, 80%) · "ok". */
export type SituacaoLimite = "ok" | "perto" | "vai-passar" | "passou"

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
  percentualAlerta: number
  /** Contas previstas da categoria no mês (o que ainda vem). */
  aindaVem: AindaVem[]
  /** A frase que responde "e agora?", contando o que ainda vem; null quando não há o que dizer. */
  resposta: string | null
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
