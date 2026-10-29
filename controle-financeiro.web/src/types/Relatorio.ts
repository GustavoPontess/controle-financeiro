import type { RespostaDoMes } from "./DinheiroDoMes"

export interface EvolucaoMensal {
  ano: number
  mes: number
  mesLabel: string
  receitas: number
  despesas: number
  /** Resultado do mês no caixa (entrou − saiu da conta naquele mês). */
  saldo: number
  /** Saldo real de todas as contas no fim do mês. */
  saldoFimDoMes: number
}

export interface GastoPorCategoria {
  descricao: string
  valor: number
  percentual: number
}

export interface ComparacaoMes {
  mesLabel: string
  receitas: number
  despesas: number
}

export interface RelatorioData {
  evolucaoMensal: EvolucaoMensal[]
  gastosPorCategoria: GastoPorCategoria[]
  comparacaoUltimosMeses: ComparacaoMes[]
}

// ── Check-up do mês (Relatórios do v2; espelha CheckUpDto) ──

export interface CategoriaDoCheckUp {
  categoriaId: string | null
  nome: string
  valor: number
  percentualDoGasto: number
  /** Média dos meses anteriores com gasto (até 3); null sem histórico. */
  normal: number | null
  /** Quanto veio acima (+) ou abaixo (−) do normal, em %. */
  variacaoPercentual: number | null
  /** Ainda vem este mês (conta fixa prevista). */
  previsto: number
}

export interface MesDoCheckUp {
  ano: number
  mes: number
  entrou: number
  saiu: number
  sobrou: number
}

export interface ContaFixaDoCheckUp { id: string; descricao: string; porMes: number }
export interface ParcelasNoMes { ano: number; mes: number; valor: number }
export interface FaturaDoCheckUp { cartaoId: string; cartao: string; vencimento: string; total: number; pago: number; restante: number; atrasada: boolean }

export interface Comprometido {
  maioresContasFixas: ContaFixaDoCheckUp[]
  totalContasFixas: number
  parcelasProximosMeses: ParcelasNoMes[]
  parcelasAteAno: number | null
  parcelasAteMes: number | null
  parcelaQueAcaba: { descricao: string; ano: number; mes: number; porMes: number } | null
  faturas: FaturaDoCheckUp[]
  /** O que sobra por mês depois do gasto normal e das parcelas (de hoje; null fora do mês atual ou sem renda). */
  folgaPorMes: number | null
  metasPedemPorMes: number
  faixaAtencao: number
  faixaAlerta: number
  resposta: RespostaDoMes | null
}

export interface ItemDeCorte { tipo: "categoria" | "conta-fixa"; id: string | null; nome: string; valor: number; normal: number | null; aMais: number; previsto: number }

/** Um aviso do "O que vale olhar". */
export interface Sinal { chave: string; origem: string; peso: number; ehDeHoje: boolean; resposta: RespostaDoMes }

export interface CheckUp {
  ano: number
  mes: number
  /** Mês em andamento: os números são "até agora". */
  mesAtual: boolean
  entrou: number
  saiu: number
  sobrou: number
  percentualQueSobrou: number | null
  /** Contra o mês anterior, em %. */
  variacaoEntrou: number | null
  variacaoSaiu: number | null
  sobrouMesAnterior: number
  contasFixasPorMes: number
  parcelasDoMes: number
  percentualComprometido: number | null
  praOndeFoi: CategoriaDoCheckUp[]
  semCategoria: { valor: number; percentualDoGasto: number; quantidade: number } | null
  mesAMes: MesDoCheckUp[]
  /** Nas contas abertas, sem as caixinhas das metas. */
  dinheiroGuardado: number
  guardadoNasMetas: number
  gastoNormal: number | null
  mesesDeReserva: number | null
  respostaReserva: RespostaDoMes | null
  comprometido: Comprometido
  corte: { resposta: RespostaDoMes; itens: ItemDeCorte[] } | null
  /** "Seus dados": o que falta pro app responder melhor. */
  sinais: Sinal[]
  resposta: RespostaDoMes
}
