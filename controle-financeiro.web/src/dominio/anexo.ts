// Anexos e localização do lançamento (2026-11-07): regras de tela num lugar só (o servidor confere de novo, em
// AnexoTransacaoService). Mudou lá, muda aqui.
import type { Ponto } from "../types/Transaction"

export const ANEXO_TAMANHO_MAX = 10 * 1024 * 1024
export const ANEXOS_POR_LANCAMENTO = 5
export const ANEXO_TIPOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
export const ANEXO_ACEITA = ANEXO_TIPOS.join(",")

/** O que há de errado com o arquivo antes de mandar, ou null. */
export const problemaDoArquivo = (arquivo: File): string | null => {
  if (!ANEXO_TIPOS.includes(arquivo.type)) return "Anexe uma foto (JPG, PNG ou WebP) ou um PDF."
  if (arquivo.size > ANEXO_TAMANHO_MAX) return "O arquivo pode ter até 10 MB."
  if (arquivo.size === 0) return "Esse arquivo está vazio."
  return null
}

export const ehPdf = (tipo: string) => tipo === "application/pdf"

/** "-19,9235, -43,9457" (4 casas, ~11 m: o mesmo que o servidor guarda). */
export const textoDoPonto = (p: Ponto) => `${p.latitude.toFixed(4).replace(".", ",")}, ${p.longitude.toFixed(4).replace(".", ",")}`

/** O ponto no mapa aberto (OpenStreetMap), numa aba nova. Só quando a pessoa clica. */
export const linkDoMapa = (p: Ponto) =>
  `https://www.openstreetmap.org/?mlat=${p.latitude}&mlon=${p.longitude}#map=18/${p.latitude}/${p.longitude}`
