// Conversão do PontesMoneyField: dígitos digitados = centavos ("150000" → 1.500,00). Sem ponto/vírgula
// ambíguo nem sinal de menos. Separado do componente pro fast refresh (arquivo de componente só
// exporta componente).

/** Até R$ 99.999.999.999,99 (13 dígitos). */
const MAX_DIGITOS = 13

export const formatarCampoDinheiro = (n: number | undefined): string =>
  n == null ? "" : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const lerCampoDinheiro = (texto: string): number | undefined => {
  const digitos = texto.replace(/\D/g, "").replace(/^0+/, "").slice(0, MAX_DIGITOS)
  return digitos ? Number(digitos) / 100 : undefined
}

/**
 * Texto COLADO é um valor em reais já escrito ("1.500", "1.500,50", "45,9", "R$ 1.500,00", "1500"),
 * não dígitos de centavo: ler no formato brasileiro. Ponto seguido de 3 dígitos = milhar; vírgula
 * (ou ponto com 1-2 dígitos no fim) = decimal. Sem número válido → undefined (a tela ignora a colagem).
 */
export const lerColagemDinheiro = (texto: string): number | undefined => {
  const t = texto.replace(/[^\d.,]/g, "")
  if (!/\d/.test(t)) return undefined
  let normal: string
  if (t.includes(",")) normal = t.replace(/\./g, "").replace(",", ".")
  else if (/\.\d{1,2}$/.test(t) && !/\.\d{3}\./.test(t)) normal = t
  else normal = t.replace(/\./g, "")
  const n = Number(normal)
  if (!Number.isFinite(n) || n <= 0) return undefined
  return Math.round(n * 100) / 100
}
