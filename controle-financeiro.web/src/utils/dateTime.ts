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
