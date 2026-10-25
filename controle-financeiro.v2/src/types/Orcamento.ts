import type { RespostaDoMes } from "./DinheiroDoMes"

/** O orçamento do mês (base zero): a renda esperada distribuída entre as despesas e os investimentos planejados. */
export interface OrcamentoDoMes {
  ano: number
  mes: number
  rendaEsperada: number
  rendaRecebida: number
  despesasPlanejadas: number
  despesasGastas: number
  /** O planejado das fontes de investimento. */
  investimentosPlanejados: number
  /** Investido no mês: aportes menos resgates. */
  investido: number
  /** Renda esperada − despesas planejadas − investimentos planejados. Zero: toda a renda tem destino; negativo: passou. */
  aAlocar: number
  resposta: RespostaDoMes
}

/** Uma FONTE planejada no mês, nas seções Receitas e Investimentos: a subcategoria (Salário, Tesouro Direto…) ou a
 *  categoria inteira. `planejado` vale todo mês até mudar; `realizado` = o que caiu (Receitas) ou o que foi investido,
 *  aportes menos resgates (Investimentos); `aindaVem` = o previsto no mês. `categoria` = a categoria da fonte. */
export interface FonteDoMes {
  categoriaId: string
  subcategoriaId: string | null
  nome: string
  categoria: string
  planejado: number
  realizado: number
  aindaVem: number
  desdeAno: number
  desdeMes: number
}

/** Fonte sem planejado (teve dinheiro ou ainda nada; a planilha mostra todas). `planejavel`: é do lado da seção. */
export interface FonteSemPlanejado {
  categoriaId: string | null
  subcategoriaId: string | null
  nome: string
  categoria: string
  realizado: number
  aindaVem: number
  planejavel: boolean
}

/** A seção Receitas (ou Investimentos) do Orçamento num mês (`editavel`: mês atual ou futuro). */
export interface FontesDoMes {
  ano: number
  mes: number
  editavel: boolean
  totalPlanejado: number
  totalRealizado: number
  totalAindaVem: number
  fontes: FonteDoMes[]
  semPlanejado: FonteSemPlanejado[]
}
