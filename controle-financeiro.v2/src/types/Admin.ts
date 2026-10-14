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

// Rótulo + cor (tone do PontesBadge) por situação — usado nas telas de admin.
export const STATUS_LABEL: Record<StatusUsuario, string> = {
  [StatusUsuario.AguardandoAprovacao]: "Pendente",
  [StatusUsuario.Ativo]: "Ativo",
  [StatusUsuario.Recusado]: "Recusado",
  [StatusUsuario.Bloqueado]: "Bloqueado",
  [StatusUsuario.MarcadoParaExclusao]: "Em exclusão",
}

export const STATUS_TONE: Record<StatusUsuario, "success" | "warning" | "danger" | "neutral"> = {
  [StatusUsuario.AguardandoAprovacao]: "warning",
  [StatusUsuario.Ativo]: "success",
  [StatusUsuario.Recusado]: "neutral",
  [StatusUsuario.Bloqueado]: "danger",
  [StatusUsuario.MarcadoParaExclusao]: "danger",
}

// Espelha DTOs/Admin/AdminDtos.cs → UsuarioAdminDto.
export interface UsuarioAdmin {
  id: string
  email: string
  nome: string
  status: StatusUsuario
  criadoEm: string
  aprovadoEm?: string | null
  ultimoAcessoEm?: string | null
  marcadoExclusaoEm?: string | null
}

// Espelha Domain/Enums/AcaoAdmin.cs (número no JSON). NÃO reordenar.
export const AcaoAdmin = {
  AprovarCadastro: 0,
  RecusarCadastro: 1,
  BloquearUsuario: 2,
  ReativarUsuario: 3,
  ForcarResetSenha: 4,
  ExportarDados: 5,
  MarcarExclusao: 6,
  CancelarExclusao: 7,
  PurgarUsuario: 8,
} as const
export type AcaoAdmin = (typeof AcaoAdmin)[keyof typeof AcaoAdmin]

export const ACAO_LABEL: Record<AcaoAdmin, string> = {
  [AcaoAdmin.AprovarCadastro]: "Aprovou cadastro",
  [AcaoAdmin.RecusarCadastro]: "Recusou cadastro",
  [AcaoAdmin.BloquearUsuario]: "Bloqueou usuário",
  [AcaoAdmin.ReativarUsuario]: "Reativou usuário",
  [AcaoAdmin.ForcarResetSenha]: "Forçou reset de senha",
  [AcaoAdmin.ExportarDados]: "Exportou dados",
  [AcaoAdmin.MarcarExclusao]: "Marcou para exclusão",
  [AcaoAdmin.CancelarExclusao]: "Cancelou exclusão",
  [AcaoAdmin.PurgarUsuario]: "Purgou usuário",
}

// Espelha DTOs/Admin/AdminDtos.cs → AdminAuditLogDto.
export interface AdminAuditLog {
  id: string
  adminEmail: string
  acao: AcaoAdmin
  alvoTipo?: string | null
  alvoId?: string | null
  alvoDescricao?: string | null
  detalhe?: string | null
  criadoEm: string
}

// Espelha DTOs/Admin/LgpdDtos.cs → ExportacaoUsuarioDto (Módulo C). Tipagem enxuta — o front só
// baixa o JSON; não precisa navegar campo a campo.
export interface ExportacaoUsuario {
  geradoEm: string
  perfil: { id: string; email: string; nome: string }
  contas: unknown[]
  cartoes: unknown[]
  transacoes: unknown[]
  metas: unknown[]
  orcamentos: unknown[]
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
