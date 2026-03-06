export interface PersonSummary {

  pessoaId: string
  nome: string

  totalReceitas: number
  totalDespesas: number
  saldo: number

}

export interface PeopleReport {

  pessoas: PersonSummary[]

  totalGeralReceitas: number
  totalGeralDespesas: number
  saldoGeral: number

}