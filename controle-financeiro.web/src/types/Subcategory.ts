export interface Subcategory {
  id: string
  nome: string
  icone?: string | null
  cor?: string | null
  categoriaId: string
  isPadrao: boolean
}
