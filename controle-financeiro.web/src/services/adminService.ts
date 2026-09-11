import { api } from "@/api/axiosConfig"
import type { AdminAuditLog, ExportacaoUsuario, MetricasAdmin, UsuarioAdmin } from "@/types/Admin"

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
  usuarios: (busca?: string) =>
    api.get<UsuarioAdmin[]>("/admin/usuarios", { params: busca ? { busca } : undefined }).then((r) => r.data),

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
  auditoria: () => api.get<AdminAuditLog[]>("/admin/auditoria").then((r) => r.data),
}

export default adminService
