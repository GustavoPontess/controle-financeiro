// A cor (série do gráfico) de cada categoria em Relatórios, a mesma na barra da renda e na lista das categorias logo
// abaixo dela, que é a legenda da barra (a cor segue a categoria, não a posição na lista). As cinco primeiras categorias, na ordem das listas (as de maior gasto primeiro), ganham as séries
// 1 a 5; da sexta em diante, cinza claro como "Outras" (repetir a cor de outra categoria confundia: "Apostas e jogos"
// saía laranja igual a Compras, 2026-11-01). "Sem categoria" e o total ("Todos os gastos") ficam cinza.

export type CategoriaComCor = { categoriaId: string | null; nome: string }

export function seriesDasCategorias(...listas: CategoriaComCor[][]): (categoriaId: string | null, nome: string) => string {
  const mapa = new Map<string, string>()
  for (const lista of listas)
    for (const c of lista)
      if (c.categoriaId && !mapa.has(c.categoriaId)) mapa.set(c.categoriaId, mapa.size < 5 ? String(mapa.size + 1) : "cinza-2")
  return (categoriaId, nome) => (categoriaId ? mapa.get(categoriaId) ?? "cinza-2" : nome === "Outras" ? "cinza-2" : "cinza")
}
