import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { palettes, fonts, PontesCategoryDonut } from "../../components/pontes"

// recharts não rende em jsdom (largura 0): vira stub. Pie e ResponsiveContainer anotam as props pra
// conferir o que o donut entrega ao gráfico (raios, centro e altura).
const rc = vi.hoisted(() => ({
  pie: undefined as Record<string, unknown> | undefined,
  container: undefined as Record<string, unknown> | undefined,
}))
vi.mock("recharts", () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return {
    PieChart: Stub, Cell: Stub, Tooltip: Stub,
    ResponsiveContainer: (props: { children?: React.ReactNode }) => { rc.container = props; return <div>{props.children}</div> },
    Pie: (props: { children?: React.ReactNode }) => { rc.pie = props; return <div>{props.children}</div> },
  }
})

const p = palettes[0]
const font = fonts[0].family
const fmt = (v: number) => `R$ ${v}`

const dados = [
  { label: "Moradia", valor: 200, percentual: 66.7 },
  { label: "Alimentação e restaurantes", valor: 100, percentual: 33.3 },
]

function renderDonut(props: Partial<React.ComponentProps<typeof PontesCategoryDonut>> = {}) {
  return render(<PontesCategoryDonut p={p} font={font} formatMoney={fmt} data={dados} {...props} />)
}

describe("PontesCategoryDonut — ajustes do Dashboard", () => {
  it("raios em % do espaço, não em px fixos: o donut acompanha a altura e a largura da coluna", () => {
    renderDonut({ height: 170 })
    expect(rc.pie).toMatchObject({ innerRadius: "65%", outerRadius: "95%", cx: "50%", cy: "50%" })
  })

  it("repassa a altura pedida ao gráfico; sem pedir, usa 220", () => {
    renderDonut({ height: 170 })
    expect(rc.container).toMatchObject({ width: "100%", height: 170 })
    renderDonut()
    expect(rc.container).toMatchObject({ height: 220 })
  })

  it("percentual com casa decimal sai em pt-BR (vírgula) na lista", () => {
    renderDonut()
    expect(screen.getByText("66,7%")).toBeInTheDocument()
    expect(screen.getByText("33,3%")).toBeInTheDocument()
    expect(screen.queryByText("66.7%")).not.toBeInTheDocument()
  })

  it("percentual inteiro continua sem casa decimal, e zero aparece como 0%", () => {
    renderDonut({ data: [
      { label: "Moradia", valor: 100, percentual: 100 },
      { label: "Lazer", valor: 0, percentual: 0 },
    ] })
    expect(screen.getByText("100%")).toBeInTheDocument()
    expect(screen.getByText("0%")).toBeInTheDocument()
  })

  it("a barra de cada categoria segue com % de ponto (é CSS), mesmo com o texto em vírgula", () => {
    const { container } = renderDonut()
    const larguras = Array.from(container.querySelectorAll<HTMLElement>('[class*="barFill"]')).map((b) => b.style.width)
    expect(larguras).toEqual(["66.7%", "33.3%"])
  })

  it("o nome da categoria traz title com o nome inteiro (a legenda trunca com reticências)", () => {
    renderDonut()
    expect(screen.getByTitle("Alimentação e restaurantes")).toHaveTextContent("Alimentação e restaurantes")
    expect(screen.getByTitle("Moradia")).toHaveTextContent("Moradia")
  })

  it("ao passar o mouse numa categoria, o centro mostra o % em pt-BR e o nome; sair volta ao total", () => {
    renderDonut()
    expect(screen.getByText("Total")).toBeInTheDocument()
    expect(screen.getByText("R$ 300")).toBeInTheDocument() // 200 + 100

    const item = screen.getByTitle("R$ 200") // o item da lista leva o valor no title
    fireEvent.mouseEnter(item)
    expect(screen.getAllByText("66,7%")).toHaveLength(2) // na lista e no centro
    expect(screen.getAllByText("Moradia")).toHaveLength(2)
    expect(screen.queryByText("Total")).not.toBeInTheDocument()

    fireEvent.mouseLeave(item)
    expect(screen.getAllByText("66,7%")).toHaveLength(1)
    expect(screen.getByText("Total")).toBeInTheDocument()
  })

  it("sem dados mostra o rótulo de vazio e não monta o gráfico", () => {
    rc.pie = undefined
    renderDonut({ data: [], emptyLabel: "Nenhuma despesa no período" })
    expect(screen.getByText("Nenhuma despesa no período")).toBeInTheDocument()
    expect(rc.pie).toBeUndefined()
  })
})
