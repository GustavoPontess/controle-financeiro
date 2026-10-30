import { api } from "../api/cliente"
import type { AdminAuditLog, ExportacaoUsuario, MetricasAdmin, StatusUsuario, UsuarioAdmin } from "@/types/Admin"
import type { ContagemNotificacaoAdmin, NotificacaoAdmin } from "@/types/NotificacaoAdmin"
import type { PagedResult } from "@/types/Paged"
import type { SolicitacaoAdmin, StatusSolicitacao } from "@/types/Solicitacao"

/**
 * Área administrativa (Módulo A — fila de aprovação + métricas do beta).
 * Todos os endpoints ficam sob a policy IsAdmin no backend: não-admin recebe 403.
 *
 * Este módulo é importado SÓ pelo chunk lazy do painel (AdminApp/telas admin) — nunca pelo bundle
 * comum. O gate de acesso (AdminRoute) lê `isAdmin` do /auth/me, não daqui, pra não arrastar estes
 * endpoints pro bundle do usuário comum.
 */
const adminService = {
  pendentes: () => api.get<UsuarioAdmin[]>("/admin/pendentes").then((r) => r.data),

  aprovar: (id: string) =>
    api.post<UsuarioAdmin>(`/admin/usuarios/${id}/aprovar`).then((r) => r.data),

  recusar: (id: string) =>
    api.post<UsuarioAdmin>(`/admin/usuarios/${id}/recusar`).then((r) => r.data),

  metricas: () => api.get<MetricasAdmin>("/admin/metricas").then((r) => r.data),

  // ── Módulo B — gestão de usuários ──
  // Busca/paginação SERVER-SIDE: manda busca+page+pageSize e devolve PagedResult (Total reflete o
  // filtro no servidor, nunca a página carregada).
  usuarios: (busca?: string, page = 1, pageSize = 25, status?: StatusUsuario) =>
    api.get<PagedResult<UsuarioAdmin>>("/admin/usuarios", {
      params: { ...(busca ? { busca } : {}), page, pageSize, ...(status !== undefined ? { status } : {}) },
    }).then((r) => r.data),

  bloquear: (id: string) =>
    api.patch<UsuarioAdmin>(`/admin/usuarios/${id}/bloquear`).then((r) => r.data),

  reativar: (id: string) =>
    api.patch<UsuarioAdmin>(`/admin/usuarios/${id}/reativar`).then((r) => r.data),

  forcarReset: (id: string) =>
    api.post(`/admin/usuarios/${id}/forcar-reset`).then((r) => r.data),

  // ── Módulo C — LGPD (exportar + exclusão em 2 estágios) ──
  exportar: (id: string) =>
    api.get<ExportacaoUsuario>(`/admin/usuarios/${id}/exportar`).then((r) => r.data),

  marcarExclusao: (id: string) =>
    api.post<UsuarioAdmin>(`/admin/usuarios/${id}/marcar-exclusao`).then((r) => r.data),

  cancelarExclusao: (id: string) =>
    api.post<UsuarioAdmin>(`/admin/usuarios/${id}/cancelar-exclusao`).then((r) => r.data),

  purgar: (id: string, emailConfirmacao: string) =>
    api.post(`/admin/usuarios/${id}/purgar`, { emailConfirmacao }).then((r) => r.data),

  // ── Módulo D — auditoria ──
  // Paginação/busca SERVER-SIDE (antes o backend capava em 200 registros fixos).
  auditoria: (busca?: string, page = 1, pageSize = 25) =>
    api.get<PagedResult<AdminAuditLog>>("/admin/auditoria", {
      params: { ...(busca ? { busca } : {}), page, pageSize },
    }).then((r) => r.data),

  // ── Notificações do admin (stream separado do financeiro) ──
  notificacoes: () => api.get<NotificacaoAdmin[]>("/admin/notificacoes").then((r) => r.data),

  contagemNotificacoes: () =>
    api.get<ContagemNotificacaoAdmin>("/admin/notificacoes/contagem").then((r) => r.data),

  marcarNotificacaoLida: (id: string) =>
    api.put(`/admin/notificacoes/${id}/lida`).then((r) => r.data),

  marcarTodasNotificacoesLidas: () =>
    api.put("/admin/notificacoes/lidas").then((r) => r.data),

  // ── Solicitações do beta (algo errado / melhoria) ──
  solicitacoes: (page = 1, pageSize = 25, status?: StatusSolicitacao) =>
    api.get<PagedResult<SolicitacaoAdmin>>("/admin/solicitacoes", {
      params: { page, pageSize, ...(status !== undefined ? { status } : {}) },
    }).then((r) => r.data),

  atualizarSolicitacao: (id: string, dados: { status: StatusSolicitacao; prioridade: number | null; notaAdmin: string | null }) =>
    api.patch<SolicitacaoAdmin>(`/admin/solicitacoes/${id}`, dados).then((r) => r.data),
}

export default adminService
