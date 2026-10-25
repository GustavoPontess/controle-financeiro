/** E-mail mascarado pra tela (ex.: "ana.souza@gmail.com" → "an•••@g•••.com"), com o olho fechado. Mesmo formato do v1. */
export function mascararEmail(valor?: string | null): string {
  const v = (valor ?? "").trim()
  if (!v) return ""
  const at = v.indexOf("@")
  if (at < 0) return (v.length <= 2 ? v.slice(0, 1) : v.slice(0, 2)) + "•••"
  const local = v.slice(0, at)
  const dominio = v.slice(at + 1)
  const inicio = (local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2)) + "•••"
  const ponto = dominio.lastIndexOf(".")
  if (ponto < 0) return `${inicio}@${dominio.slice(0, 1)}•••`
  return `${inicio}@${dominio.slice(0, 1)}•••${dominio.slice(ponto)}`
}
