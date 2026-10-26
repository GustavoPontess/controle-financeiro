// Como mostrar um aparelho (sessão ou dispositivo confiável) a partir do User-Agent que o servidor guardou —
// só navegador e sistema, sem fingerprint. E as datas dessas listas: o servidor grava em UTC sem fuso no
// texto ("2026-10-15T20:35:48"), então sem o "Z" o navegador leria como hora local e erraria em 3 horas.

export type Aparelho = { nome: string; celular: boolean }

export function resumirAparelho(ua?: string | null): Aparelho {
  if (!ua) return { nome: "Aparelho desconhecido", celular: false }
  const navegador = /Edg/i.test(ua) ? "Edge"
    : /OPR|Opera/i.test(ua) ? "Opera"
    : /Firefox/i.test(ua) ? "Firefox"
    : /Chrome|CriOS/i.test(ua) ? "Chrome"
    : /Safari/i.test(ua) ? "Safari"
    : "Navegador"
  const sistema = /Windows/i.test(ua) ? "Windows"
    : /Android/i.test(ua) ? "Android"
    : /iPhone|iPad|iOS/i.test(ua) ? "iOS"
    : /Mac OS X|Macintosh/i.test(ua) ? "macOS"
    : /Linux/i.test(ua) ? "Linux"
    : ""
  return { nome: sistema ? `${navegador} no ${sistema}` : navegador, celular: /Android|iPhone|iPad|Mobile/i.test(ua) }
}

/** "15/10/2026 às 17:20" no horário de quem está vendo, a partir do UTC do servidor (com ou sem "Z"). */
export function quandoLocal(isoUtc: string): string {
  const temFuso = /(Z|[+-]\d{2}:?\d{2})$/i.test(isoUtc)
  const d = new Date(temFuso ? isoUtc : `${isoUtc}Z`)
  if (Number.isNaN(d.getTime())) return ""
  const dia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d)
  const hora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(d)
  return `${dia} às ${hora}`
}
