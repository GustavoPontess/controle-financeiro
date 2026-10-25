import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import Mosaico from "../../componentes/Mosaico"

// O jsdom não mede layout: a largura do mosaico e a altura de cada caixa vêm daqui (a altura sai do data-altura
// do conteúdo). Sem ResizeObserver no jsdom, o Mosaico mede uma vez ao montar, que é o que o teste precisa.
let largura = 0
const originais = {
  clientWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth"),
  offsetHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight"),
}
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => largura })
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement) { return Number(this.firstElementChild?.getAttribute("data-altura") ?? 0) },
  })
})
afterEach(() => {
  if (originais.clientWidth) Object.defineProperty(HTMLElement.prototype, "clientWidth", originais.clientWidth)
  if (originais.offsetHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", originais.offsetHeight)
})

const caixas = (alturas: number[]) => alturas.map((h, i) => <div key={i} data-altura={h}>Caixa {i + 1}</div>)
const posicao = (texto: string) => (screen.getByText(texto).parentElement as HTMLElement).style.transform

describe("Mosaico (Visão geral em colunas, estilo Pinterest)", () => {
  it("estreito (celular): uma coluna, as caixas na ordem, sem posicionar", () => {
    largura = 360
    render(<Mosaico>{caixas([300, 100, 100])}</Mosaico>)
    expect(screen.getAllByText(/Caixa \d/).map((c) => c.textContent)).toEqual(["Caixa 1", "Caixa 2", "Caixa 3"])
    expect(posicao("Caixa 1")).toBe("")
  })

  it("largo: cada caixa cai na coluna MAIS CURTA, sem buraco embaixo da caixa baixa", () => {
    largura = 800 // 2 colunas de 390px (380 mínimo + 20 de espaço)
    render(<Mosaico>{caixas([300, 100, 100, 100])}</Mosaico>)
    expect(posicao("Caixa 1")).toBe("translate(0px, 0px)")      // coluna 1
    expect(posicao("Caixa 2")).toBe("translate(410px, 0px)")    // coluna 2
    expect(posicao("Caixa 3")).toBe("translate(410px, 120px)")  // coluna 2 ainda é a mais curta (120 < 320)
    expect(posicao("Caixa 4")).toBe("translate(410px, 240px)")  // e de novo (240 < 320)
  })

  it("ignora item vazio (caixa condicional que não aparece)", () => {
    largura = 360
    render(<Mosaico>{[<div key="a" data-altura={10}>Caixa 1</div>, null, false, <div key="b" data-altura={10}>Caixa 2</div>]}</Mosaico>)
    expect(screen.getAllByText(/Caixa \d/)).toHaveLength(2)
  })
})
