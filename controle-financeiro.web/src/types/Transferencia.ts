export interface Transferencia {
  id: string
  contaOrigemId: string
  contaOrigemNome: string
  contaDestinoId: string
  contaDestinoNome: string
  valor: number
  data: string
  descricao: string
}

export interface CriarTransferencia {
  contaOrigemId: string
  contaDestinoId: string
  valor: number
  /** Dia "YYYY-MM-DD" (sem fuso); o backend recusa dia futuro. */
  data: string
  /** Hora "HH:MM:SS" (sem fuso) — vai pras duas pernas; null = sem hora. */
  hora: string | null
  descricao: string
}
