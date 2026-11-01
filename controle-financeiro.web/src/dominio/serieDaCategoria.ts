// A cor (série do gráfico) de cada categoria em Relatórios, a mesma em todas as seções: a barra da renda e os limites
// do "Quanto ainda posso gastar" e a barra e a lista do "Pra onde foi a sua renda" (a cor segue a categoria, não a
// posição na lista). As categorias, na ordem das listas (as de maior gasto primeiro), ganham as séries 1 a 5 em volta;
// "Sem categoria" e o total ("Todos os gastos", nos limites) ficam cinza e "Outras" (as menores juntas) cinza claro.

export type CategoriaComCor = { categoriaId: string | null; nome: string }

export function seriesDasCategorias(...listas: CategoriaComCor[][]): (categoriaId: string | null, nome: string) => string {
  const mapa = new Map<string, string>()
  for (const lista of listas)
    for (const c of lista)
      if (c.categoriaId && !mapa.has(c.categoriaId)) mapa.set(c.categoriaId, String((mapa.size % 5) + 1))
  return (categoriaId, nome) => (categoriaId ? mapa.get(categoriaId) ?? "cinza-2" : nome === "Outras" ? "cinza-2" : "cinza")
}
