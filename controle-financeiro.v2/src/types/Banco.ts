export interface Banco {
  id: string
  nome: string
  nomeFantasia: string
  razaoSocial: string
  codigoBanco?: string
  tipo: number
  tipoDescricao: string
  ativo: boolean
  logoUrl?: string
  cor?: string
}
