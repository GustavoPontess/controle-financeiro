// Ciclos de fatura do cartão — sequência CONTÍNUA de meses pro navegador de faturas.
//
// O backend só cria a fatura de um mês quando entra um lançamento nele. Então a lista real pode ter
// buracos (meses sem compra) e pode nem conter o mês de hoje (ex.: cartão que só tem parcelas
// futuras). Antes, o navegador só andava entre faturas existentes e, sem fatura cobrindo hoje, caía
// na mais recente e a rotulava "atual" — mostrava Jan/2027 como mês atual em set/2026.
//
// Aqui cada ciclo = um mês de fechamento. A regra de período ESPELHA o backend
// (FaturaService.CalcularPeriodo / CalcularVencimento): a fatura que fecha no mês M vai do dia de
// fechamento de M-1 até o de M, com o dia limitado ao último dia do mês; sem dia de fechamento,
// mês calendário. Mudou lá, muda aqui.
import type { Fatura } from "../../types/Fatura"

export type ProjLancamento = { id: string; descricao: string; valor: number; data: string }

/** Fatura real, prevista (projetada das assinaturas) ou vazia (mês sem lançamento, só navegação). */
export type FaturaView = Fatura & { prevista?: boolean; vazia?: boolean; projLancamentos?: ProjLancamento[] }

const diasNoMes = (ano: number, mes0: number) => new Date(Date.UTC(ano, mes0 + 1, 0)).getUTCDate()

/** Índice absoluto do mês (ano*12 + mês0) a partir de "YYYY-MM-..." — lê a string, imune a fuso. */
export const indiceMes = (iso: string) => Number(iso.slice(0, 4)) * 12 + (Number(iso.slice(5, 7)) - 1)

/** Ciclo que FECHA no mês (ano, mes0). */
export function cicloQueFechaEm(ano: number, mes0: number, diaFechamento?: number): { inicio: Date; fechamento: Date } {
  if (!diaFechamento) {
    return { inicio: new Date(Date.UTC(ano, mes0, 1)), fechamento: new Date(Date.UTC(ano, mes0, diasNoMes(ano, mes0))) }
  }
  const fechamento = new Date(Date.UTC(ano, mes0, Math.min(diaFechamento, diasNoMes(ano, mes0))))
  const antAno = mes0 === 0 ? ano - 1 : ano
  const antMes = mes0 === 0 ? 11 : mes0 - 1
  const inicio = new Date(Date.UTC(antAno, antMes, Math.min(diaFechamento, diasNoMes(antAno, antMes))))
  return { inicio, fechamento }
}

/** Ciclo que contém o dia calendário (ano, mes0, dia). Antes do dia de fechamento → fecha neste mês;
 * no dia do fechamento ou depois → já é o ciclo que fecha no mês seguinte. */
export function cicloDoDia(ano: number, mes0: number, dia: number, diaFechamento?: number) {
  if (!diaFechamento) return cicloQueFechaEm(ano, mes0)
  if (dia < Math.min(diaFechamento, diasNoMes(ano, mes0))) return cicloQueFechaEm(ano, mes0, diaFechamento)
  return mes0 === 11 ? cicloQueFechaEm(ano + 1, 0, diaFechamento) : cicloQueFechaEm(ano, mes0 + 1, diaFechamento)
}

/** Mês "YYYY-MM" da fatura em que cai uma compra do dia `iso` ("YYYY-MM-DD"): o mês em que essa fatura
 * FECHA, que é o rótulo dela na tela Cartões. Antes do dia de fechamento → mês da compra; no dia ou
 * depois → mês seguinte; sem dia de fechamento → mês da compra. Com o dia de hoje, é a fatura aberta.
 * "" se a data for inválida. */
export function mesDaFaturaDoDia(iso: string, diaFechamento?: number): string {
  const [ano, mes, dia] = iso.split("-").map(Number)
  if (!ano || !mes || !dia) return ""
  return cicloDoDia(ano, mes - 1, dia, diaFechamento).fechamento.toISOString().slice(0, 7)
}

/** "YYYY-MM" somado de `n` meses (negativo volta). "" se o mês for inválido. */
export function somarMeses(mes: string, n: number): string {
  const [ano, m] = mes.split("-").map(Number)
  if (!ano || !m) return ""
  const i = ano * 12 + (m - 1) + n
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`
}

/** Primeira parcela mais cedo que o parcelamento aceita ("YYYY-MM") — espelha o piso do
 * ParcelamentoService: a MAIS TARDE entre a fatura em que a compra cai e a 1ª fatura que ainda NÃO
 * VENCEU (`hojeIso` = dia LOCAL de quem usa). A fatura que já fechou mas ainda não venceu vale — é nela
 * que o banco cobra a compra feita antes do fechamento e lançada depois. Fatura vencida não: a parcela
 * nasceria pendente numa fatura vencida (juros/multa) ou já paga. Compra em andamento (`jaPagas` > 0):
 * mínimo da PRÓXIMA a pagar — a fatura da compra anda uma por parcela já paga. "" se a data da compra
 * for inválida. */
export function mesMinimoPrimeiraParcela(
  dataCompraIso: string, hojeIso: string, diaFechamento?: number, diaVencimento?: number, jaPagas = 0,
): string {
  const daCompra = mesDaFaturaDoDia(dataCompraIso, diaFechamento)
  const [ano, mes, dia] = hojeIso.split("-").map(Number)
  if (!daCompra || !ano || !mes || !dia) return ""
  const aberta = cicloDoDia(ano, mes - 1, dia, diaFechamento)
  const hoje = new Date(Date.UTC(ano, mes - 1, dia))
  // A anterior à aberta fechou em `aberta.inicio`; ainda aceita cobrança se não venceu.
  const naoVencida = vencimentoDe(aberta.inicio, diaVencimento) >= hoje ? aberta.inicio : aberta.fechamento
  const piso = naoVencida.toISOString().slice(0, 7)
  const pelaCompra = somarMeses(daCompra, jaPagas)
  return piso > pelaCompra ? piso : pelaCompra
}

/** Rótulo da fatura pelo mês de fechamento ("Outubro de 2026") — o mesmo em Cartões e Parcelamentos.
 * Formata em UTC: o backend manda a data como meia-noite UTC e o fuso local jogaria pro mês anterior. */
export function rotuloMesFatura(dataFechamento: string): string {
  const m = new Date(dataFechamento).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })
  return m.charAt(0).toUpperCase() + m.slice(1)
}

/** Vencimento: dia de vencimento no mês do fechamento se cair depois dele; senão, no mês seguinte.
 * Sem dia de vencimento → fechamento + 10 dias. */
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

/** Índice (no array de ciclos) do mês que contém hoje. */
export function indiceMesDeHoje(hoje: Date, diaFechamento?: number) {
  const { fechamento } = cicloDoDia(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), diaFechamento)
  return fechamento.getUTCFullYear() * 12 + fechamento.getUTCMonth()
}

/**
 * Monta a sequência contínua de ciclos, do mais recente (índice 0) ao mais antigo. Cobre do ciclo
 * mais antigo com fatura real até o mais novo (real ou previsto), e SEMPRE inclui o mês de hoje.
 * Mês sem fatura vira uma fatura "vazia" (R$ 0, só pra navegação). Real tem prioridade sobre prevista.
 * `hoje` é o dia calendário LOCAL do usuário.
 */
export function montarCiclos(p: {
  reais: Fatura[]
  previstas: FaturaView[]
  hoje: Date
  cartaoId: string
  cartaoNome: string
  diaFechamento?: number
  diaVencimento?: number
}): FaturaView[] {
  const porMes = new Map<number, FaturaView>()
  for (const f of p.previstas) porMes.set(indiceMes(f.dataFechamento), f)
  for (const f of p.reais) porMes.set(indiceMes(f.dataFechamento), f)

  const mesHoje = indiceMesDeHoje(p.hoje, p.diaFechamento)
  const indices = [...porMes.keys(), mesHoje]
  const maisNovo = Math.max(...indices)
  const maisAntigo = Math.min(...indices)

  const ciclos: FaturaView[] = []
  for (let i = maisNovo; i >= maisAntigo; i--) {
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
