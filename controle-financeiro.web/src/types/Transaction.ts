export interface Transaction {
  id: string
  descricao: string
  valor: number
  tipo: number
  categoriaId: string | null
  subcategoriaId?: string | null
  contaId?: string
  contaNome?: string
  cartaoCreditoId?: string
  cartaoCreditoNome?: string
  usadoComoCredito?: boolean
  meioPagamento?: number
  meioPagamentoDescricao?: string
  faturaId?: string
  parcelas?: number
  numeroParcela?: number
  /** Linha de Transações › Gastos que é a compra parcelada inteira (id = o parcelamento; valor = o total). */
  ehCompraParcelada?: boolean
  /** Total ÷ parcelas, pra "5x de R$ 300,00". */
  valorParcela?: number | null
  // Origem do lançamento — usados pra rotular a natureza na lista
  // (recorrente / parcelado / pagamento de fatura) quando não há hora.
  recorrenteOrigemId?: string | null
  parcelamentoId?: string | null
  parcelaTransacaoId?: string | null
  ehPagamentoFatura?: boolean
  /** A fatura que o pagamento quitou. Sem ela, é pagamento que veio do extrato sem a fatura no app: só o registro (exclui aqui). */
  faturaPagaId?: string | null
  // Perna de transferência entre contas próprias — neutra no extrato.
  ehTransferencia?: boolean
  // Dinheiro de empréstimo (emprestei, peguei, voltou, devolvi): mexe no saldo, fora do resultado do mês.
  ehEmprestimo?: boolean
  // Quanto do pagamento de empréstimo é juros/multa: só isso entra como receita ou gasto (o resto é o dinheiro voltando).
  valorJuros?: number | null
  // Dinheiro que passou entre membros da família (acerto): mexe no saldo, fora do resultado; desfaz em Entre vocês.
  ehAcerto?: boolean
  // 0 = Previsao, 1 = Executado, 2 = Cancelado (resposta).
  statusTransacao?: number
  // Envio na criação: true = já recebido/pago (Executado); false = previsão.
  efetivado?: boolean
  /** Dia do lançamento, "YYYY-MM-DD" (date puro, sem fuso). */
  data: string
  /** Hora do lançamento, "HH:MM:SS" — ou null/ausente quando não tem hora. */
  hora?: string | null
  // ── Família (despesa dividida) ──
  /** Família com quem está dividida (null = só sua). Na criação: dividir já ao salvar. */
  familiaId?: string | null
  /** 0 não precisa · 1 esperando aprovação · 2 aprovada · 3 recusada. */
  statusAprovacao?: 0 | 1 | 2 | 3
  /** Pra quem foi o gasto (dependente da família), mesmo sem dividir. */
  dependenteId?: string | null
  /** Quem cuida dessa conta na família (só rótulo/filtro; não muda a divisão). */
  responsavelUsuarioId?: string | null
  /** Onde aconteceu: o ponto do aparelho ("Usar onde estou"), arredondado no servidor a ~11 m. Só o dono recebe. */
  latitude?: number | null
  longitude?: number | null
}

/** Anexo do lançamento (print da nota, foto, PDF). O arquivo sai por `urlDoAnexo`. */
export interface AnexoTransacao {
  id: string
  nome: string
  /** "image/webp" (foto, redesenhada pelo servidor) ou "application/pdf". */
  tipoConteudo: string
  tamanho: number
  criadoEm: string
}

/** Um ponto (graus decimais). */
export interface Ponto { latitude: number; longitude: number }