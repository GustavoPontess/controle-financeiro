// Páginas legais: a transferência internacional (servidor nos EUA) aparece em destaque com o que a LGPD art. 33 e a
// Resolução CD/ANPD nº 19/2024 art. 17 pedem, e as duas páginas dão o controlador e um contato de verdade.
import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { Privacidade, TermosDeUso } from "../../telas/Legal"

const abrir = (pagina: React.ReactNode) => render(<MemoryRouter>{pagina}</MemoryRouter>)

describe("Política de Privacidade", () => {
  it("diz logo no topo que os dados ficam nos EUA, com link pra seção em destaque", () => {
    const { container } = abrir(<Privacidade />)
    expect(screen.getByText("Seus dados ficam num servidor nos Estados Unidos.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "onde ficam e por quê" })).toHaveAttribute("href", "#onde-ficam")
    expect(container.querySelector("#onde-ficam")).not.toBeNull()
  })

  it("a seção da transferência tem finalidade, destino, duração, base legal, segurança e quem responde", () => {
    const { container } = abrir(<Privacidade />)
    const secao = within(container.querySelector<HTMLElement>("#onde-ficam")!)
    for (const item of ["Pra quê:", "Pra onde:", "Como e por quanto tempo:", "Por que pode:", "Segurança:", "Seus direitos e quem responde:"])
      expect(secao.getByText(item)).toBeInTheDocument()
    expect(secao.getByText(/art\. 33, IX, com o art\. 7º, V/)).toBeInTheDocument()
    expect(secao.getByRole("link", { name: "privacidade@pontesdev.com.br" })).toHaveAttribute("href", "mailto:privacidade@pontesdev.com.br")
  })

  it("link direto pra seção (#onde-ficam) rola até ela depois que a página monta", () => {
    const rolar = vi.fn()
    Element.prototype.scrollIntoView = rolar
    render(<MemoryRouter initialEntries={["/privacidade#onde-ficam"]}><Privacidade /></MemoryRouter>)
    expect(rolar).toHaveBeenCalledTimes(1)
    expect(rolar.mock.contexts[0]).toHaveProperty("id", "onde-ficam")
  })

  it("dá o controlador, o contato e o direito de reclamar à ANPD", () => {
    abrir(<Privacidade />)
    expect(screen.getByText(/Quem cuida dos seus dados \(controlador\) é Gustavo Pontes/)).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "ANPD" })[0]).toHaveAttribute("href", "https://www.gov.br/anpd")
    expect(screen.queryByText(/quem te convidou/)).toBeNull()
  })

  it("pedido de dados vai pro canal da LGPD (privacidade@), nunca pro login do admin (pontes@)", () => {
    const { container } = abrir(<Privacidade />)
    const links = screen.getAllByRole("link", { name: /@pontesdev\.com\.br$/ })
    expect(links.length).toBeGreaterThanOrEqual(2)
    for (const l of links) expect(l).toHaveAttribute("href", "mailto:privacidade@pontesdev.com.br")
    expect(container.textContent).not.toContain("pontes@pontesdev.com.br")
  })
})

describe("Termos de Uso", () => {
  it("o contato é o contato@ (nunca o pontes@, que é o login do admin)", () => {
    const { container } = abrir(<TermosDeUso />)
    expect(screen.getByRole("link", { name: "contato@pontesdev.com.br" })).toHaveAttribute("href", "mailto:contato@pontesdev.com.br")
    expect(container.textContent).not.toContain("pontes@pontesdev.com.br")
    expect(screen.queryByText(/quem te convidou/)).toBeNull()
  })
})
