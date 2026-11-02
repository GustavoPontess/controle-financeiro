import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import GraficoBarrasComparacao, { type LinhaComparacao } from "../../componentes/GraficoBarrasComparacao"

const linha = (nome: string, valor: number, recolhida?: boolean): LinhaComparacao =>
  ({ chave: nome, nome, valor, normal: null, variacao: null, serie: recolhida ? "cinza-2" : "1", recolhida })

describe("GraficoBarrasComparacao", () => {
  it("as recolhidas ficam atrás de \"Mais N categorias\", a última linha, que abre ali mesmo", async () => {
    render(<GraficoBarrasComparacao rotulo="Categorias" linhas={[
      linha("Mercado", 900), linha("Pets", 270, true), linha("Seguros", 210, true), linha("Sem categoria", 50),
    ]} />)
    const lista = screen.getByRole("list", { name: "Categorias" })
    expect(within(lista).queryByText("Pets")).not.toBeInTheDocument()
    const mais = within(lista).getByRole("button", { name: /Mais 2 categorias/ })
    expect(mais.textContent).toMatch(/R\$\s480,00/)
    expect(within(lista).getAllByRole("listitem").at(-1)).toContainElement(mais) // sempre por último

    await userEvent.click(mais)
    const nomes = within(lista).getAllByRole("listitem").map((li) => li.textContent)
    expect(nomes[2]).toMatch(/^Pets/) // as recolhidas abrem depois das de cima (inclusive Sem categoria)
    expect(nomes.at(-1)).toMatch(/Mostrar menos/)
  })
})
