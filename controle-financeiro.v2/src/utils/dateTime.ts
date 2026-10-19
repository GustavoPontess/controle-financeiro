// Data "YYYY-MM-DD" no fuso LOCAL de quem usa (padrão: hoje). Nunca usar
// `new Date().toISOString().split("T")[0]` pra "hoje": isso é o dia em UTC, e das
// 21h à meia-noite (Brasília) já é amanhã — formulário abria com a data de amanhã.
export function dataLocalISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
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
    const n = new Date()
    return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate(), n.getHours(), n.getMinutes(), n.getSeconds())).toISOString()
  }
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).toISOString()
}

// Hora atual "HH:MM" no fuso LOCAL (default do campo de hora). Usa componentes locais,
// não UTC — é a hora de parede de quem lança.
export function horaLocalHHMM(d: Date = new Date()): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
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
