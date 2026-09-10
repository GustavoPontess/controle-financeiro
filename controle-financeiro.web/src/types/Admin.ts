// Espelha ControleFinanceiro.Api/Domain/Enums/StatusUsuario.cs. Enums vão como NÚMERO no JSON
// (padrão do projeto — sem JsonStringEnumConverter). NÃO reordenar: os valores são persistidos.
// Const object (não `enum` TS — o projeto usa `erasableSyntaxOnly`), igual aos outros enums do front.
export const StatusUsuario = {
  AguardandoAprovacao: 0,
  Ativo: 1,
  Recusado: 2,
  Bloqueado: 3,
  MarcadoParaExclusao: 4,
} as const

export type StatusUsuario = (typeof StatusUsuario)[keyof typeof StatusUsuario]

// Espelha DTOs/Admin/AdminDtos.cs → UsuarioAdminDto.
export interface UsuarioAdmin {
  id: string
  email: string
  nome: string
  status: StatusUsuario
  criadoEm: string
  aprovadoEm?: string | null
  ultimoAcessoEm?: string | null
}

// Espelha DTOs/Admin/AdminDtos.cs → MetricasAdminDto.
export interface MetricasAdmin {
  total: number
  pendentes: number
  ativos: number
  recusados: number
  bloqueados: number
  marcadosParaExclusao: number
  cadastrosUltimos7Dias: number
  ativosUltimos7Dias: number
}
