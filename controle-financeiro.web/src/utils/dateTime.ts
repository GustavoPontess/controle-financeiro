// Relógio do app (regra de hora, 2026-11-01): todo "agora", "hoje" e "mês atual" do front sai daqui, no fuso de
// quem usa. Tela não chama `new Date()` / `Date.now()` direto (trava em test/relogioUnico.test.ts): um lugar só
// pra ler o relógio, e o dia nunca pelo UTC (`toISOString()`). Os testes congelam este relógio no setup.ts.
export function agora(): Date {
  return new Date()
}

// O fuso da CONTA (2026-11-02): o mesmo que o servidor usa pra "que dia é hoje" (`Usuario.fusoHorario`, nome IANA).
// O AuthProvider põe ele aqui ao carregar a pessoa; sem conta (ou sem fuso) vale o do aparelho. Assim o dia da tela e o
// do servidor são sempre o mesmo, mesmo com o aparelho em outro fuso (viagem), até a pessoa aceitar o novo.
let fusoDaConta: string | null = null

/** O fuso do aparelho, nome IANA ("America/Rio_Branco"). */
export function fusoDoAparelho(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** Usa este fuso pro "hoje" e pros horários da tela (null = o do aparelho). Nome que o navegador não conhece é ignorado. */
export function definirFusoDaConta(fuso: string | null | undefined): void {
  fusoDaConta = fuso && fusoValido(fuso) ? fuso : null
}

/** O fuso que a tela usa agora: o da conta, ou o do aparelho. */
export function fusoEmUso(): string {
  return fusoDaConta ?? fusoDoAparelho()
}

function fusoValido(fuso: string): boolean {
  try { new Intl.DateTimeFormat("en-US", { timeZone: fuso }); return true } catch { return false }
}

/** Ano, mês, dia, hora e minuto de um instante no fuso em uso (sem fuso da conta: os do aparelho). */
function partes(d: Date): { a: number; m: number; d: number; h: number; min: number; s: number } {
  if (!fusoDaConta) return { a: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), h: d.getHours(), min: d.getMinutes(), s: d.getSeconds() }
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: fusoDaConta, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23",
  }).formatToParts(d).map((x) => [x.type, Number(x.value)]))
  return { a: p.year, m: p.month, d: p.day, h: p.hour, min: p.minute, s: p.second }
}

/** O mês de hoje no fuso de quem usa (mes de 1 a 12). */
export function mesAtual(): { ano: number; mes: number } {
  const p = partes(agora())
  return { ano: p.a, mes: p.m }
}

// Data "YYYY-MM-DD" no fuso de quem usa (o da conta; padrão: hoje). Nunca usar
// `new Date().toISOString().split("T")[0]` pra "hoje": isso é o dia em UTC, e das
// 21h à meia-noite (Brasília) já é amanhã — formulário abria com a data de amanhã.
export function dataLocalISO(d: Date = agora()): string {
  const p = partes(d)
  return `${p.a}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`
}

// Converte data "YYYY-MM-DD" em ISO com hora, encodando o wall-clock LOCAL
// como UTC (Date.UTC dos componentes locais). O backend guarda como timestamp
// e a tabela formata com getUTC* — assim o que o usuário vê é exatamente a
// hora que ele lançou, sem shift de fuso.
//
// Regra de hora: lançamento de HOJE usa a hora atual (é uma ação real, com
// horário — compra à vista, pagamento de fatura, etc., ordenam cronológico por
// dia+hora). Data passada/futura usa meio-dia (sem horário "real" a capturar).
export function dataComHora(dateStr: string): string {
  if (dateStr === dataLocalISO()) {
    const n = partes(agora())
    return new Date(Date.UTC(n.a, n.m - 1, n.d, n.h, n.min, n.s)).toISOString()
  }
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).toISOString()
}

// Hora atual "HH:MM" no fuso LOCAL (default do campo de hora). Usa componentes locais,
// não UTC — é a hora de parede de quem lança.
export function horaLocalHHMM(d: Date = agora()): string {
  const p = partes(d)
  return `${String(p.h).padStart(2, "0")}:${String(p.min).padStart(2, "0")}`
}

// Combina data "YYYY-MM-DD" + hora "HH:MM" (escolhidas pelo usuário) num ISO, encodando o
// wall-clock LOCAL como UTC (Date.UTC dos componentes) — mesma convenção do `dataComHora`,
// pra a tabela formatar com getUTC* e mostrar exatamente a hora lançada, sem shift de fuso.
// Hora vazia/ inválida cai no comportamento antigo (`dataComHora`: hoje = agora, resto = meio-dia).
export function combinarDataHora(dateStr: string, hora?: string): string {
  const m = (hora ?? "").match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return dataComHora(dateStr)
  const hh = Number(m[1]), mm = Number(m[2])
  if (hh > 23 || mm > 59) return dataComHora(dateStr)
  const [y, mo, d] = dateStr.split("-").map(Number)
  return new Date(Date.UTC(y, mo - 1, d, hh, mm, 0)).toISOString()
}

// Extrai "HH:MM" de um ISO guardado como wall-clock-em-UTC (getUTC*) — pra pré-preencher o
// campo de hora ao editar. Bate com o `fmtData` da tabela, que também lê em UTC.
export function isoParaHoraHHMM(iso: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`
}

// "YYYY-MM-DD" + n dias (meio-dia local: mudança de horário nunca empurra pro dia vizinho).
export function somaDias(iso: string, n: number): string {
  const [a, m, d] = iso.split("-").map(Number)
  return dataLocalISO(new Date(a, m - 1, d + n, 12))
}

// Dia seguinte de "YYYY-MM-DD" (pra filtro "até" inclusivo: o back trata `to` como exclusivo, Data < to).
export function diaSeguinte(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number)
  return dataLocalISO(new Date(a, m - 1, d + 1, 12))
}

// Máscara de digitação "HH:MM" (só dígitos → HH:MM), pro campo de hora.
export function mascararHora(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 4)
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`
}

/** Instante do servidor (UTC, com ou sem "Z": `criadoEm`, `atualizadoEm`…) → "15/10/2026" no dia de quem vê.
 *  `dataBR` lê o dia escrito e, das 21h à meia-noite em Brasília, mostrava o dia seguinte. */
export function diaDeInstante(isoUtc: string): string {
  const temFuso = /(Z|[+-]\d{2}:?\d{2})$/i.test(isoUtc)
  const d = new Date(temFuso ? isoUtc : `${isoUtc}Z`)
  return Number.isNaN(d.getTime()) ? "" : dataBR(dataLocalISO(d))
}

/** "2026-10-15T00:00:00" ou "2026-10-15" → "15/10/2026" (sem fuso: o dia é o que está escrito). */
export function dataBR(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-")
  return `${d}/${m}/${a}`
}
