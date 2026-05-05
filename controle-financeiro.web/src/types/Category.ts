export interface Category {
  id: string
  descricao: string
  finalidade: number // 1 = Despesa, 2 = Receita, 3 = Ambas
  isPadrao: boolean
}