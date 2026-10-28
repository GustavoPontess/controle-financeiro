// "Não sou robô" (Cloudflare Turnstile): a chave pública do widget vem da API (GET /auth/verificacao). Null = desligado
// (dev, testes, ou sem as chaves no deploy): as telas não mostram nada. Pergunta uma vez por carregamento.
import { api } from "../api/cliente"

let chave: Promise<string | null> | null = null

export const chaveDaVerificacao = (): Promise<string | null> =>
  (chave ??= api
    .get<{ chaveDoSite?: string | null }>("/auth/verificacao", { skipErrorToast: true })
    .then((r) => r.data?.chaveDoSite ?? null)
    .catch(() => { chave = null; return null }))
