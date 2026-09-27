// Traduz um erro de chamada à API na notificação certa pro usuário.
//
// Regra de negócio ou validação (resposta 4xx COM mensagem do servidor) é AVISO: nada quebrou, o
// usuário consegue resolver — ex.: "Limite insuficiente. Precisa de R$ X, disponível R$ Y." — e a
// mensagem do servidor é exatamente o que ele precisa ler. Antes, esses casos viravam um "Erro ao
// criar parcelamento" genérico em vermelho, escondendo o motivo.
// Sem resposta (rede), 5xx ou 4xx sem mensagem é ERRO de verdade, com o texto de fallback da tela.
export type SeveridadeErro = "warning" | "error"

export function notificacaoDeErro(err: unknown, fallback: string): { message: string; severity: SeveridadeErro } {
  const resp = (err as { response?: { status?: number; data?: { message?: string } } })?.response
  const mensagem = resp?.data?.message?.trim()
  const status = resp?.status ?? 0
  if (mensagem && status >= 400 && status < 500) return { message: mensagem, severity: "warning" }
  return { message: fallback, severity: "error" }
}
