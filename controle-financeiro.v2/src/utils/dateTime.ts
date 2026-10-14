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

// Máscara de digitação "HH:MM" (só dígitos → HH:MM), pro campo de hora.
export function mascararHora(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 4)
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`
}
