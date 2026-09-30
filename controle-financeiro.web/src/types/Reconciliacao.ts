// Marco de reconciliação (espelha ReconciliacaoSaldoDto do backend).
export interface ReconciliacaoMarco {
  id: string
  contaId: string
  dataHora: string
  saldoDeclarado: number
  saldoCalculado: number
  /** declarado − calculado no momento da conferência. 0 = bateu. */
  diferenca: number
  /** 1 = Baseline, 2 = Verificação. */
  tipo: number
  temAjuste: boolean
  /** Marco derivado do saldo inicial da conta — não é removível (pra mudar, edita a conta). */
  derivado?: boolean
  observacao?: string
  criadoEm: string
}

export interface CriarMarcoReconciliacao {
  contaId: string
  dataHora: string
  saldoDeclarado: number
  /** 1 = Baseline (1º ponto de verdade da conta), 2 = Verificação. */
  tipo: number
  /** "ajustar" cria o lançamento de ajuste; vazio = não cria (usuário lança manual). */
  resolucao?: string
  observacao?: string
}

export const TIPO_MARCO = { Baseline: 1, Verificacao: 2 } as const
