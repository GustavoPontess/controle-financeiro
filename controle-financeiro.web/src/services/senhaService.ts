// Recuperar senha: pedir o link (POST /auth/forgot-password — resposta igual pra qualquer e-mail) e
// redefinir com o token do e-mail (POST /auth/reset-password — derruba todas as sessões da conta).
import { api } from "../api/cliente"

export const pedirLinkDeSenha = async (email: string): Promise<void> => {
  await api.post("/auth/forgot-password", { email }, { skipErrorToast: true })
}

export const redefinirSenha = async (token: string, novaSenha: string, confirmarNovaSenha: string): Promise<void> => {
  await api.post("/auth/reset-password", { token, novaSenha, confirmarNovaSenha }, { skipErrorToast: true })
}
