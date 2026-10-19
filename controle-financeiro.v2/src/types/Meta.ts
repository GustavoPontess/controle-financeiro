/** "concluida" (marcada: registro) · "chegou-la" (guardado ≥ alvo, ainda em andamento) · "sem-prazo" ·
 *  "prazo-passou" · "no-ritmo" · "atras" (calculado no servidor). */
export type SituacaoMeta = "concluida" | "chegou-la" | "sem-prazo" | "prazo-passou" | "no-ritmo" | "atras"

/**
 * Meta no modelo de caixinha (como o Nubank): cada meta tem a própria conta (`contaId`, tipo Caixinha) e guardar
 * é uma transferência de verdade da conta da pessoa pra ela. `guardado` = saldo da caixinha.
 */
export interface Meta {
  id: string
  nome: string
  descricao: string | null
  /** Chave do ícone (ver ICONES_META). */
  icone: string
  valorAlvo: number
  guardado: number
  falta: number
  percentualConcluido: number
  /** A pessoa marcou "Concluir e usar o dinheiro": está em Concluídas e é só registro. */
  concluida: boolean
  /** Mês do prazo (dia 1, ISO) ou null. */
  dataLimite: string | null
  /** Meses até o prazo contando o atual; null sem prazo/concluída. */
  mesesRestantes: number | null
  /** Quanto guardar por mês pra chegar no prazo; null sem prazo, concluída ou prazo passado. */
  porMes: number | null
  situacao: SituacaoMeta
  /** A caixinha da meta (conta tipo 7). Null só em meta antiga que nunca guardou nada. */
  contaId: string | null
  usuarioId: string
  familiaId: string | null
  categoriaId: string | null
  ativo: boolean
  criadoEm: string
  atualizadoEm: string
  /** Concluída de vez ("Concluir e usar o dinheiro"): quando, e quanto juntou. Aí `guardado` é 0. */
  concluidaEm: string | null
  valorJuntado: number | null
}

export interface CriarMetaDto {
  nome: string
  descricao?: string | null
  valorAlvo: number
  /** "YYYY-MM-01" (o mês do prazo) ou null. */
  dataLimite?: string | null
  familiaId?: string | null
  categoriaId?: string | null
  icone?: string | null
}

/** "Essa meta cabe?": quanto pede por mês × o que sobra no mês (renda esperada − gasto típico − outras metas). */
export interface ViabilidadeMeta {
  porMes: number | null
  meses: number | null
  folga: number | null
  rendaEsperada: number | null
  gastoTipico: number | null
  outrasMetasPorMes: number
  /** Mês (ISO, dia 1) em que dá pra chegar guardando a folga, quando o prazo não cabe ou não tem prazo. */
  prazoQueCabe: string | null
  resposta: { tom: "positivo" | "alerta" | "negativo" | "neutro"; texto: string; acoes: { rotulo: string; para: string }[] }
}

/** Uma linha do histórico: guardou (de uma conta pra caixinha) ou resgatou (da caixinha pra uma conta). */
export interface MovimentoMeta {
  transferenciaId: string
  /** Dia (ISO, meia-noite). */
  data: string
  tipo: "guardou" | "resgatou"
  contaId: string
  contaNome: string
  valor: number
}
