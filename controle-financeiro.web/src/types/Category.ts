export interface Category {
  id: string
  descricao: string
  finalidade: number // 0 = Despesa, 1 = Receita, 2 = Ambas
}