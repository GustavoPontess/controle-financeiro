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

// Links do e-mail de "pedido recebido": o dono do e-mail confirma que é dele (o pedido segue pra aprovação) ou diz
// "Não fui eu" (o pedido e os dados dele são apagados). Link vencido ou usado: 400 com a mesma frase.
export const confirmarEmailDoCadastro = async (token: string): Promise<void> => {
  await api.post("/auth/cadastro/confirmar-email", { token }, { skipErrorToast: true })
}

export const naoFuiEuNoCadastro = async (token: string): Promise<void> => {
  await api.post("/auth/cadastro/nao-fui-eu", { token }, { skipErrorToast: true })
}
