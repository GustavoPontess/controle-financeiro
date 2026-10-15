// Criar conta (POST /auth/register). No beta a conta nasce aguardando aprovação do admin — a resposta é
// só uma mensagem (não há sessão). A API responde igual se o e-mail já existe (anti-enumeração).
import { api } from "../api/cliente"

export type CadastroPayload = {
  nome: string
  email: string
  /** "YYYY-MM-DD" ou null */
  dataNascimento: string | null
  password: string
  confirmPassword: string
}

export type CadastroResposta = { status: number; mensagem: string }

export const cadastrar = async (dados: CadastroPayload): Promise<CadastroResposta> => {
  const r = await api.post<CadastroResposta>("/auth/register", dados, { skipErrorToast: true })
  return r.data
}
