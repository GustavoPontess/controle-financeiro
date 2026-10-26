// Ciclos de fatura do cartão — a sequência contínua de meses da página do cartão.
// O servidor só cria a fatura de um mês quando entra um lançamento nele; a lista real pode ter buracos e
// pode nem conter o mês de hoje. Aqui cada ciclo = um mês de fechamento, e a regra do período espelha o
// servidor (FaturaService.CalcularPeriodo / CalcularVencimento): a fatura que fecha no mês M vai do dia de
// fechamento de M-1 até o de M (dia limitado ao último do mês); sem dia de fechamento, mês calendário.
// Datas do servidor chegam como meia-noite UTC — tudo aqui lê/forma em UTC pra não escorregar de mês.
import type { Fatura } from "../types/Fatura"

/** Fatura real ou um mês sem lançamento (vazia: R$ 0, só pra navegação). */
export type Ciclo = Fatura & { vazia?: boolean }

const diasNoMes = (ano: number, mes0: number) => new Date(Date.UTC(ano, mes0 + 1, 0)).getUTCDate()

/** Índice absoluto do mês (ano*12 + mês0) a partir de "YYYY-MM-…" — lê o texto, imune a fuso. */
export const indiceMes = (iso: string) => Number(iso.slice(0, 4)) * 12 + (Number(iso.slice(5, 7)) - 1)

/** Ciclo que FECHA no mês (ano, mes0). */
export function cicloQueFechaEm(ano: number, mes0: number, diaFechamento?: number): { inicio: Date; fechamento: Date } {
  if (!diaFechamento)
    return { inicio: new Date(Date.UTC(ano, mes0, 1)), fechamento: new Date(Date.UTC(ano, mes0, diasNoMes(ano, mes0))) }
  const fechamento = new Date(Date.UTC(ano, mes0, Math.min(diaFechamento, diasNoMes(ano, mes0))))
  const antAno = mes0 === 0 ? ano - 1 : ano
  const antMes = mes0 === 0 ? 11 : mes0 - 1
  const inicio = new Date(Date.UTC(antAno, antMes, Math.min(diaFechamento, diasNoMes(antAno, antMes))))
  return { inicio, fechamento }
}

/** Ciclo que contém o dia calendário: antes do dia de fechamento → fecha neste mês; no dia ou depois → no seguinte. */
export function cicloDoDia(ano: number, mes0: number, dia: number, diaFechamento?: number) {
  if (!diaFechamento) return cicloQueFechaEm(ano, mes0)
  if (dia < Math.min(diaFechamento, diasNoMes(ano, mes0))) return cicloQueFechaEm(ano, mes0, diaFechamento)
  return mes0 === 11 ? cicloQueFechaEm(ano + 1, 0, diaFechamento) : cicloQueFechaEm(ano, mes0 + 1, diaFechamento)
}

/** Vencimento: dia de vencimento no mês do fechamento se cair depois dele; senão, no mês seguinte. Sem dia → +10 dias. */
export function vencimentoDe(fechamento: Date, diaVencimento?: number): Date {
  if (!diaVencimento) return new Date(fechamento.getTime() + 10 * 86_400_000)
  const ano = fechamento.getUTCFullYear()
  const mes0 = fechamento.getUTCMonth()
  const mesmoMes = new Date(Date.UTC(ano, mes0, Math.min(diaVencimento, diasNoMes(ano, mes0))))
  if (mesmoMes > fechamento) return mesmoMes
  const proxAno = mes0 === 11 ? ano + 1 : ano
  const proxMes = mes0 === 11 ? 0 : mes0 + 1
  return new Date(Date.UTC(proxAno, proxMes, Math.min(diaVencimento, diasNoMes(proxAno, proxMes))))
}

/** Índice do mês de fechamento do ciclo que contém hoje (dia calendário LOCAL). */
export function indiceMesDeHoje(hoje: Date, diaFechamento?: number) {
  const { fechamento } = cicloDoDia(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), diaFechamento)
  return fechamento.getUTCFullYear() * 12 + fechamento.getUTCMonth()
}

/**
 * Sequência contínua de ciclos, do mais ANTIGO ao mais novo (a faixa de meses lê da esquerda pra direita),
 * cobrindo da fatura real mais antiga até a mais nova e SEMPRE o mês de hoje. Mês sem fatura vira "vazia".
 */
export function montarCiclos(p: { reais: Fatura[]; hoje: Date; cartaoId: string; cartaoNome: string; diaFechamento?: number; diaVencimento?: number }): Ciclo[] {
  const porMes = new Map<number, Ciclo>()
  for (const f of p.reais) porMes.set(indiceMes(f.dataFechamento), f)
  const mesHoje = indiceMesDeHoje(p.hoje, p.diaFechamento)
  const indices = [...porMes.keys(), mesHoje]
  const maisNovo = Math.max(...indices)
  const maisAntigo = Math.min(...indices)
  const ciclos: Ciclo[] = []
  for (let i = maisAntigo; i <= maisNovo; i++) {
    const existente = porMes.get(i)
    if (existente) { ciclos.push(existente); continue }
    const ano = Math.floor(i / 12)
    const mes0 = i % 12
    const { inicio, fechamento } = cicloQueFechaEm(ano, mes0, p.diaFechamento)
    ciclos.push({
      id: `vazia-${ano}-${mes0 + 1}`,
      cartaoCreditoId: p.cartaoId,
      cartaoCreditoNome: p.cartaoNome,
      dataInicio: inicio.toISOString(),
      dataFechamento: fechamento.toISOString(),
      dataVencimento: vencimentoDe(fechamento, p.diaVencimento).toISOString(),
      status: 1, statusDescricao: "Aberta",
      estadoCiclo: 0, estadoPagamento: 0, estaAtrasada: false,
      valorTotal: 0, valorPago: 0, valorRestante: 0, vencida: false,
      vazia: true,
    })
  }
  return ciclos
}

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

/** "out" / "out/25" (ano só quando não é o atual) — rótulo da faixa de meses. */
export function mesCurto(dataFechamento: string, anoAtual = new Date().getFullYear()): string {
  const ano = Number(dataFechamento.slice(0, 4))
  const m = MESES_CURTOS[Number(dataFechamento.slice(5, 7)) - 1]
  return ano === anoAtual ? m : `${m}/${String(ano).slice(2)}`
}

/** "Outubro de 2026" — rótulo da fatura pelo mês de fechamento (lido em UTC, como o servidor manda). */
export function rotuloMesFatura(dataFechamento: string): string {
  const m = new Date(dataFechamento).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })
  return m.charAt(0).toUpperCase() + m.slice(1)
}

/** "05/11" (UTC: meia-noite do servidor não escorrega de dia). */
export const diaMes = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })

/** Dias até a data (UTC), a partir do dia local de hoje. Negativo = já passou. */
export function diasAte(iso: string, hoje = new Date()): number {
  const alvo = Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
  const base = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  return Math.round((alvo - base) / 86_400_000)
}

export type EstadoFatura = { rotulo: string; tom?: "positivo" | "negativo" | "alerta" }

/** A etiqueta da fatura: o que a pessoa precisa saber dela num relance. */
export function estadoDaFatura(f: Ciclo, hoje = new Date()): EstadoFatura {
  if (f.vazia) return { rotulo: "Sem lançamentos" }
  if (f.valorTotal > 0 && f.valorRestante <= 0) return { rotulo: "Paga", tom: "positivo" }
  if (f.estaAtrasada || (f.vencida && f.valorRestante > 0)) return { rotulo: "Atrasada", tom: "negativo" }
  if (f.estadoCiclo === 1) {
    const d = diasAte(f.dataVencimento, hoje)
    const quando = d === 0 ? "vence hoje" : d === 1 ? "vence amanhã" : d > 1 ? `vence em ${d} dias` : "vencida"
    return { rotulo: f.valorPago > 0 ? `Parcial · ${quando}` : `Fechada · ${quando}`, tom: d <= 3 ? "alerta" : undefined }
  }
  const d = diasAte(f.dataFechamento, hoje)
  const quando = d === 0 ? "fecha hoje" : d === 1 ? "fecha amanhã" : d > 1 ? `fecha em ${d} dias` : "fechando"
  return { rotulo: `Aberta · ${quando}`, tom: d <= 3 ? "alerta" : undefined }
}

export const NOME_BANDEIRA: Record<number, string> = { 1: "Visa", 2: "Mastercard", 3: "Elo", 4: "Hipercard", 5: "American Express", 6: "Outra" }
