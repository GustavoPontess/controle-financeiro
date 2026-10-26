// Dispositivos confiáveis (MFA "confiar neste dispositivo por 30 dias"): listar, esquecer um, esquecer todos.
// O cookie `td` vai junto (Path do auth), então o servidor marca qual é o deste navegador.
import { api } from "../api/cliente"

export interface DispositivoConfiavel {
  id: string
  criadoEm: string
  ultimoUsoEm?: string | null
  /** Até quando pula o código. */
  expiraEm: string
  dispositivo?: string | null
  ip?: string | null
  /** É o deste navegador. */
  atual: boolean
}

const dispositivoService = {
  listar: () => api.get<DispositivoConfiavel[]>("/auth/trusted-devices").then((r) => r.data),
  esquecer: (id: string) => api.post(`/auth/trusted-devices/${id}/revogar`),
  esquecerTodos: () => api.post<{ esquecidos: number }>("/auth/trusted-devices/revogar-todos").then((r) => r.data),
}

export default dispositivoService
