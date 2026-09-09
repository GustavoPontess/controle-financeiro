import { api } from "@/api/axiosConfig"
import type { AdminMe, MetricasAdmin, UsuarioAdmin } from "@/types/Admin"

/**
 * Área administrativa (Módulo A — fila de aprovação + métricas do beta).
 * Todos os endpoints ficam sob a policy IsAdmin no backend: não-admin recebe 403.
 */
const adminService = {
  // Probe de acesso admin. `skipErrorToast`: o 403 pra não-admin é esperado (a página trata
  // renderizando "sem acesso") — não deve disparar o toast global de erro.
  me: () => api.get<AdminMe>("/admin/me", { skipErrorToast: true }).then((r) => r.data),

  pendentes: () => api.get<UsuarioAdmin[]>("/admin/pendentes").then((r) => r.data),

  aprovar: (id: string) =>
    api.post<UsuarioAdmin>(`/admin/usuarios/${id}/aprovar`).then((r) => r.data),

  recusar: (id: string) =>
    api.post<UsuarioAdmin>(`/admin/usuarios/${id}/recusar`).then((r) => r.data),

  metricas: () => api.get<MetricasAdmin>("/admin/metricas").then((r) => r.data),
}

export default adminService
