import { api } from "../api/cliente"
import type { ExportacaoUsuario } from "@/types/Admin"

/**
 * Autoatendimento do titular sobre a própria conta (LGPD Art. 18).
 * Exclusão em 2 passos (step-up: senha + 2º fator), reativação na carência e exportação de dados.
 * `skipErrorToast` deixa a tela tratar o erro inline (a rede de segurança global não duplica o toast).
 */
export type MetodoExclusao = "totp" | "email"

const contaService = {
  /** Passo 1: confirma a senha; sem MFA dispara o PIN por e-mail. Retorna o 2º fator a pedir. */
  enviarCodigoExclusao: (senhaAtual: string) =>
    api.post<{ metodo: MetodoExclusao }>("/auth/conta/excluir/enviar-codigo", { senhaAtual }, { skipErrorToast: true })
      .then((r) => r.data.metodo),

  /** Passo 2: senha + código do 2º fator → marca a conta pra exclusão (carência 30d) e encerra a sessão. */
  excluirConta: (senhaAtual: string, codigo: string) =>
    api.post("/auth/conta/excluir", { senhaAtual, codigo }, { skipErrorToast: true }).then(() => undefined),

  /** Reativa a própria conta na carência (usuário deslogado). Depois é só logar de novo. */
  reativarConta: (email: string, senha: string) =>
    api.post<{ mensagem: string }>("/auth/conta/reativar", { email, senha }, { skipErrorToast: true }).then((r) => r.data),

  /** Baixa os próprios dados (LGPD acesso/portabilidade). */
  exportarMeusDados: () =>
    api.get<ExportacaoUsuario>("/auth/conta/exportar", { skipErrorToast: true }).then((r) => r.data),
}

export default contaService
