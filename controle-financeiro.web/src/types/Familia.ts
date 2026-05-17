export interface Familia {
  id: string
  nome: string
  criadoPorUsuarioId: string
  criadoEm: string
  ehAdmin: boolean
  totalMembros: number
}

export interface MembroFamilia {
  id: string
  usuarioId: string
  nomeUsuario: string
  emailUsuario: string
  papel: string
  entrouEm: string
}

export type StatusConvite = 1 | 2 | 3 | 4 | 5 // Pendente, Aceito, Recusado, Revogado, Expirado

export interface ConviteFamilia {
  id: string
  familiaId: string
  nomeFamilia: string
  emailConvidado: string
  papel: string
  status: StatusConvite
  expiraEm: string
  criadoEm: string
  token: string
}

export interface FamiliaDetalhe {
  id: string
  nome: string
  criadoPorUsuarioId: string
  criadoEm: string
  ehAdmin: boolean
  membros: MembroFamilia[]
  convitesPendentes: ConviteFamilia[]
}

export interface DespesaCompartilhada {
  id: string
  descricao: string
  valor: number
  data: string
  categoriaNome: string | null
  pagadorUsuarioId: string
  pagadorNome: string
}

export interface SaldoMembro {
  usuarioId: string
  nome: string
  pagou: number
  saldo: number
}

export interface BalancoFamilia {
  mes: number
  ano: number
  total: number
  cota: number
  saldos: SaldoMembro[]
}
