// Renda da pessoa (espelha RendaMesDto): o que entrou no mês (fato) e o que ela esperava.
export interface EntradaRenda {
  id: string
  /** "YYYY-MM-DD" */
  data: string
  descricao: string
  valor: number
  subcategoria: string | null
  recebida: boolean
  contaFixa: boolean
}

export interface RendaMes {
  ano: number
  mes: number
  /** Fixas + variável esperada. */
  previsto: number
  /** Contas fixas de receita do mês (já recebidas ou ainda previstas). */
  fixas: number
  /** A variável esperada que vale neste mês (a do mês, ou herdada do último mês que tem). */
  variavelEsperada: number
  /** A variável foi definida neste mês mesmo (false = herdada ou nenhuma). */
  variavelDoMes: boolean
  recebido: number
  falta: number
  sugestaoMedia3Meses: number | null
  entradas: EntradaRenda[]
}

/** O que a família vê da renda de um membro (VisibilidadeRenda do servidor). */
export type VisibilidadeRenda = 0 | 1 | 2 | 3
export const VISIBILIDADE_RENDA = { nada: 0, soPeso: 1, valorParaAlguns: 2, valorParaTodos: 3 } as const satisfies Record<string, VisibilidadeRenda>

/** Renda da casa no mês, já filtrada no servidor por quem pede (RendaFamiliaDto). */
export interface RendaFamilia {
  ano: number
  mes: number
  total: number
  previsto: number
  membros: { usuarioId: string; nome: string; mostrada: boolean; recebido: number | null; previsto: number | null }[]
}
