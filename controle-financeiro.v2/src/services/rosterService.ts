import { api } from "../api/cliente"

/** Item do chooser pré-login (roster). Nunca traz e-mail inteiro — só o mascarado. */
export interface ContaLembrada {
  usuarioId: string
  nome: string
  emailMascarado: string
}

/**
 * Roster / "escolher conta" (chooser pré-login, opt-in). Autenticado só pelo cookie opaco de device
 * `rd` (httpOnly + SameSite=Strict), enviado automático pelo axios. Nunca loga ninguém.
 */
const rosterService = {
  listar: () => api.get<ContaLembrada[]>("/auth/roster").then((r) => r.data),
  // E-mail real revelado só no clique (a lista só tem mascarado) pra pré-preencher o campo.
  obterEmail: (usuarioId: string) =>
    api.get<{ email: string }>(`/auth/roster/${usuarioId}/email`).then((r) => r.data.email),
  remover: (usuarioId: string) => api.delete(`/auth/roster/${usuarioId}`),
  esquecerTodas: () => api.delete("/auth/roster"),
}

export default rosterService
