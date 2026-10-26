import { api } from "../api/cliente"
import type { Sessao } from "@/types/Sessao"

/**
 * Sessões ativas do usuário (todos os dispositivos). Diferente do logout-all (que é do navegador):
 * aqui o usuário vê e encerra sessões em qualquer dispositivo. Endpoints exigem sessão + CSRF.
 */
const sessaoService = {
  listar: () => api.get<Sessao[]>("/auth/sessions").then((r) => r.data),
  revogar: (id: string) => api.post(`/auth/sessions/${id}/revogar`).then((r) => r.data),
  revogarOutras: () =>
    api.post<{ encerradas: number }>("/auth/sessions/revogar-outras").then((r) => r.data),
}

export default sessaoService
