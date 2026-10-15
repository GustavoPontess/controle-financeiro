// Regras de exibição e de formulário da conta bancária, usadas por mais de uma tela (lista, página,
// formulário, encerrar). Espelham o servidor (ContaService.ValidarFormato, CriarContaDto).
import type { Conta } from "../types/Conta"

/** Enum TipoConta do back. Cartão e Empréstimo não são conta pra criar aqui (têm telas próprias). */
export const TIPO_CONTA = { corrente: 1, poupanca: 2, dinheiro: 4 } as const
export const TIPOS_CONTA = [
  { valor: String(TIPO_CONTA.corrente), rotulo: "Conta corrente" },
  { valor: String(TIPO_CONTA.poupanca), rotulo: "Poupança" },
]

export const MAX_NOME_CONTA = 100
/** Agência: só números, até 10 dígitos. */
export const AGENCIA = /^\d{1,10}$/
/** Número: só números, com dígito verificador opcional depois de hífen (91205195-5). */
export const NUMERO_CONTA = /^\d{1,30}(-\d{1,2})?$/

/** "Conta corrente · ag 0001 · cc 1234-5". O banco fica de fora: a marca já mostra, e o nome que vem do
 *  Banco Central é a razão social ("NU PAGAMENTOS S.A. - INSTITUIÇÃO DE PAGAMENTO"). */
export function descreverConta(c: Pick<Conta, "tipo" | "agencia" | "numeroConta" | "isCarteira">): string {
  if (c.isCarteira) return "Dinheiro em mãos"
  const tipo = c.tipo === TIPO_CONTA.poupanca ? "Poupança" : "Conta corrente"
  return [tipo, c.agencia ? `ag ${c.agencia}` : null, c.numeroConta ? `cc ${c.numeroConta}` : null]
    .filter(Boolean).join(" · ")
}
