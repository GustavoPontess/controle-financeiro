import { api } from "@/api/axiosConfig"
import type { MetricasAdmin, UsuarioAdmin } from "@/types/Admin"

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
}

export default adminService
