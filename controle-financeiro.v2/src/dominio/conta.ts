// Regras de exibição e de formulário da conta bancária, usadas por mais de uma tela (lista, página,
// formulário, encerrar). Espelham o servidor (ContaService.ValidarFormato, CriarContaDto).
import type { Conta } from "../types/Conta"

/** Enum TipoConta do back. Cartão (3) e Empréstimo (5) não são conta pra criar aqui (têm telas próprias). */
export const TIPO_CONTA = { corrente: 1, poupanca: 2, dinheiro: 4, investimento: 6 } as const
/** Os tipos que a pessoa cria em Bancos, na ordem do formulário. `curto` cabe no segmento. */
export const TIPOS_CONTA = [
  { valor: String(TIPO_CONTA.corrente), rotulo: "Conta corrente", curto: "Corrente", exemplo: "Nubank" },
  { valor: String(TIPO_CONTA.poupanca), rotulo: "Poupança", curto: "Poupança", exemplo: "Poupança Caixa" },
  { valor: String(TIPO_CONTA.investimento), rotulo: "Investimentos", curto: "Investimentos", exemplo: "XP" },
  { valor: String(TIPO_CONTA.dinheiro), rotulo: "Dinheiro", curto: "Dinheiro", exemplo: "Cofrinho" },
]
export const rotuloTipo = (c: Pick<Conta, "tipo" | "isCarteira">): string =>
  c.isCarteira ? "Dinheiro em mãos" : TIPOS_CONTA.find((t) => t.valor === String(c.tipo))?.rotulo ?? "Conta"
/** Dinheiro não tem banco, agência nem número. */
export const temDadosBancarios = (tipo: number) => tipo !== TIPO_CONTA.dinheiro
/** Guardado = poupança ou investimentos. A carteira nunca é (mesmo gravada com tipo antigo). */
export const ehGuardado = (c: Pick<Conta, "tipo" | "isCarteira">) =>
  !c.isCarteira && (c.tipo === TIPO_CONTA.poupanca || c.tipo === TIPO_CONTA.investimento)
/** Dinheiro em espécie: a carteira padrão e as outras que a pessoa criar (cofrinho, caixa de casa). */
export const ehDinheiro = (c: Pick<Conta, "tipo" | "isCarteira">) => c.isCarteira || c.tipo === TIPO_CONTA.dinheiro

export const MAX_NOME_CONTA = 100
/** Agência: só números, até 10 dígitos. */
export const AGENCIA = /^\d{1,10}$/
/** Número: só números, com dígito verificador opcional depois de hífen (91205195-5). */
export const NUMERO_CONTA = /^\d{1,30}(-\d{1,2})?$/

/** "Conta corrente · ag 0001 · cc 1234-5". O banco fica de fora: a marca já mostra, e o nome que vem do
 *  Banco Central é a razão social ("NU PAGAMENTOS S.A. - INSTITUIÇÃO DE PAGAMENTO"). */
export function descreverConta(c: Pick<Conta, "tipo" | "agencia" | "numeroConta" | "isCarteira">): string {
  if (c.isCarteira) return "Dinheiro em mãos"
  if (!temDadosBancarios(c.tipo)) return rotuloTipo(c)
  return [rotuloTipo(c), c.agencia ? `ag ${c.agencia}` : null, c.numeroConta ? `cc ${c.numeroConta}` : null]
    .filter(Boolean).join(" · ")
}
