// Regras e listas de lançamento usadas por mais de uma tela (nova, editar). Números = enums do back.

/** Meio de pagamento (enum MeioPagamento do back). Crédito é o único que vai pro cartão. */
export const MEIO = { dinheiro: 1, debito: 2, credito: 3, pix: 4, ted: 5, boleto: 6 } as const

/** Ordem de exibição: o mais usado primeiro. */
export const MEIOS_PAGAMENTO = [
  { valor: MEIO.pix, rotulo: "Pix" },
  { valor: MEIO.debito, rotulo: "Débito" },
  { valor: MEIO.credito, rotulo: "Crédito" },
  { valor: MEIO.dinheiro, rotulo: "Dinheiro" },
  { valor: MEIO.ted, rotulo: "TED / DOC" },
  { valor: MEIO.boleto, rotulo: "Boleto" },
]
/** Meios de conta (sem crédito): receita e edição de lançamento em conta. */
export const MEIOS_CONTA = MEIOS_PAGAMENTO.filter((m) => m.valor !== MEIO.credito)

/** Parcelas no cartão (1 = à vista). O back aceita até 360; a lista cobre o que loja oferece. */
export const PARCELAS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24]

/** Frequência da conta fixa (enum FrequenciaRecorrencia do back). */
export const FREQUENCIAS = [
  { valor: 2, rotulo: "Todo mês" },
  { valor: 1, rotulo: "Toda semana" },
  { valor: 3, rotulo: "Todo ano" },
]

/** Tipo (enum TipoTransacao): 1 = despesa, 2 = receita. Categoria com finalidade 3 serve pros dois. */
export const TIPO = { despesa: 1, receita: 2 } as const

/** [MaxLength(255)] da descrição no back (transação e transferência). */
export const MAX_DESCRICAO = 255

/** "HH:MM" válido (00:00–23:59)? */
export const horaValida = (h: string) => {
  const m = h.match(/^(\d{2}):(\d{2})$/)
  return !!m && Number(m[1]) <= 23 && Number(m[2]) <= 59
}
