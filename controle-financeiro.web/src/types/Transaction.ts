export interface Transaction {
  id: string
  descricao: string
  valor: number
  tipo: number
  categoriaId: string | null
  contaId?: string
  data: string
}