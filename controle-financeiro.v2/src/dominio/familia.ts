// Família: rótulos e listas que mais de uma tela usa (lista, página da família, convite, dependente, acerto).
// Espelham os enums do servidor (PapelFamilia, ModoRateio, TipoDependente, StatusAprovacaoDespesa).
import type { ModoRateio, PapelFamilia, StatusAprovacaoDespesa, TipoDependente } from "../types/Familia"

export const PAPEL_PERMISSAO = { admin: 1, membro: 2, dependente: 3 } as const satisfies Record<string, PapelFamilia>
export const ROTULO_PERMISSAO: Record<PapelFamilia, string> = { 1: "Admin", 2: "Membro", 3: "Só vê" }

/** Relação com a família (texto livre no servidor, até 30): os mais comuns prontos, "Outro" digita. */
export const PAPEIS_RELACAO = ["Cônjuge", "Companheiro(a)", "Namorado(a)", "Pai/Mãe", "Filho(a)", "Irmão/Irmã", "Sócio(a)", "Amigo(a)"] as const
export const MAX_PAPEL = 30
export const MAX_NOME_FAMILIA = 100

export const MODOS_RATEIO: { valor: ModoRateio; rotulo: string; detalhe: string }[] = [
  { valor: 1, rotulo: "Igual pra todos", detalhe: "cada adulto paga a mesma parte" },
  { valor: 2, rotulo: "Proporcional à renda", detalhe: "quem ganha mais paga mais; cada um informa a própria renda" },
  { valor: 3, rotulo: "Por despesa", detalhe: "a divisão é escolhida em cada lançamento" },
]
export const rotuloModoRateio = (m: ModoRateio) => MODOS_RATEIO.find((x) => x.valor === m)?.rotulo ?? "Igual pra todos"

export const TIPOS_DEPENDENTE: { valor: TipoDependente; rotulo: string }[] = [
  { valor: 1, rotulo: "Criança" },
  { valor: 2, rotulo: "Idoso" },
  { valor: 3, rotulo: "Pet" },
  { valor: 4, rotulo: "Outro" },
]
export const rotuloTipoDependente = (t: TipoDependente) => TIPOS_DEPENDENTE.find((x) => x.valor === t)?.rotulo ?? "Outro"

export const APROVACAO = { naoRequerida: 0, pendente: 1, aprovada: 2, rejeitada: 3 } as const satisfies Record<string, StatusAprovacaoDespesa>

/** "Outubro de 2026" */
export function nomeDoMes(mes: number, ano: number): string {
  const txt = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(ano, mes - 1, 1))
  return txt.charAt(0).toUpperCase() + txt.slice(1)
}

/** Primeiro nome ("Gustavo Nunes Pontes" → "Gustavo"). */
export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome

/** Copy sem cobrança (visão §7.5): saldo positivo = a receber; negativo = a acertar; zero = em dia. */
export function fraseSaldo(saldo: number): { texto: string; tom: "positivo" | "negativo" | "neutro" } {
  if (saldo > 0.005) return { texto: "a receber", tom: "positivo" }
  if (saldo < -0.005) return { texto: "a acertar", tom: "negativo" }
  return { texto: "em dia", tom: "neutro" }
}
