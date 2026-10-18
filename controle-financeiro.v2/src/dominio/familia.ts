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

/** Copy sem cobrança (visão §7.5, Gustavo 2026-10-18): o que cada um pagou no mês é FATO, não obrigação.
 *  Positivo = pagou a mais que a parte; negativo = pagou a menos; zero = equilibrado. Nada de "deve", "a acertar". */
export function fraseSaldo(saldo: number): { texto: string; tom: "positivo" | "negativo" | "neutro" } {
  if (saldo > 0.005) return { texto: "pagou a mais", tom: "positivo" }
  if (saldo < -0.005) return { texto: "pagou a menos", tom: "negativo" }
  return { texto: "equilibrado", tom: "neutro" }
}

export type Equilibrio = { deUsuarioId: string; de: string; paraUsuarioId: string; para: string; valor: number }

/** O menor conjunto de "X passa R$ V pra Y" que zera o mês (modelo Tricount: é sugestão, não cobrança).
 *  Quem pagou a menos passa pra quem pagou a mais, casando o maior com o maior. */
export function sugerirEquilibrio(saldos: { usuarioId: string; nome: string; saldo: number }[]): Equilibrio[] {
  const recebem = saldos.filter((s) => s.saldo > 0.005).map((s) => ({ ...s, resto: s.saldo })).sort((a, b) => b.resto - a.resto)
  const passam = saldos.filter((s) => s.saldo < -0.005).map((s) => ({ ...s, resto: -s.saldo })).sort((a, b) => b.resto - a.resto)
  const out: Equilibrio[] = []
  let i = 0, j = 0
  while (i < passam.length && j < recebem.length) {
    const v = Math.min(passam[i].resto, recebem[j].resto)
    out.push({ deUsuarioId: passam[i].usuarioId, de: primeiroNome(passam[i].nome), paraUsuarioId: recebem[j].usuarioId, para: primeiroNome(recebem[j].nome), valor: Math.round(v * 100) / 100 })
    passam[i].resto -= v; recebem[j].resto -= v
    if (passam[i].resto < 0.005) i++
    if (recebem[j].resto < 0.005) j++
  }
  return out
}
