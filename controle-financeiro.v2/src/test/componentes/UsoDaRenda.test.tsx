import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import UsoDaRenda from "../../componentes/UsoDaRenda"
import type { DinheiroDoMes } from "../../types/DinheiroDoMes"

const base: DinheiroDoMes = {
  ano: 2026, mes: 10, rendaEsperada: 3069.4, rendaRecebida: 3903.23, rendaBase: 3903.23, jaSaiu: 6077.13, aindaVemTotal: 99.9,
  livre: -2273.8, percentualUsado: 158.3,
  jaSaiuPorCategoria: [
    { categoriaId: null, nome: "Sem categoria", valor: 4312.13, percentualDaRenda: 110.5 },
    { categoriaId: "moradia", nome: "Moradia", valor: 1765, percentualDaRenda: 45.2 },
  ],
  aindaVem: [{ transacaoId: "t1", contaFixaId: "cf1", descricao: "Internet", data: "2026-10-20", categoriaId: "moradia", categoria: "Moradia", valor: 99.9 }],
  resposta: { tom: "negativo", texto: "Saiu mais do que entrou: R$ 2.173,90 acima da renda.", acoes: [{ rotulo: "Classificar lançamentos", para: "/transacoes" }] },
  faturas: [
    { faturaId: "f0", cartaoId: "inter", cartao: "Inter", dataInicio: "2026-08-05T00:00:00", dataFechamento: "2026-09-04T00:00:00", dataVencimento: "2026-09-12T00:00:00", total: 150, pago: 0, restante: 150, atrasada: true },
    { faturaId: "f1", cartaoId: "nubank", cartao: "Nubank", dataInicio: "2026-09-03T00:00:00", dataFechamento: "2026-10-02T00:00:00", dataVencimento: "2026-10-10T00:00:00", total: 1200, pago: 200, restante: 1000, atrasada: false },
  ],
  faturasAPagar: 1150,
  parcelasFuturas: {
    total: 4000, ateAno: 2027, ateMes: 2,
    porMes: [{ ano: 2026, mes: 11, valor: 1000 }, { ano: 2026, mes: 12, valor: 1000 }, { ano: 2027, mes: 1, valor: 1000 }, { ano: 2027, mes: 2, valor: 1000 }],
  },
}
const Onde = () => <p>em {useLocation().pathname}</p>
const renderizar = (dados: DinheiroDoMes) => render(
  <MemoryRouter initialEntries={["/"]}>
    <Routes>
      <Route path="/" element={<UsoDaRenda dados={dados} />} />
      <Route path="*" element={<Onde />} />
    </Routes>
  </MemoryRouter>,
)

describe("UsoDaRenda", () => {
  it("mostra quanto da renda foi usado, o que já saiu, o que ainda vem (com a conta fixa) e quanto passou", () => {
    renderizar(base)
    expect(screen.getByText("158% usado")).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "158% da renda usada" })).toBeInTheDocument()
    expect(screen.getByText("sua renda")).toBeInTheDocument() // passou: a marca da renda aparece
    const saiu = screen.getByRole("list", { name: "Já saiu" })
    expect(within(saiu).getAllByRole("listitem").map((l) => l.textContent)).toEqual([
      expect.stringContaining("Sem categoria"), expect.stringContaining("Moradia"),
    ])
    const vem = screen.getByRole("list", { name: "Ainda vem este mês" })
    expect(within(vem).getByRole("link")).toHaveAttribute("href", "/contas-fixas/cf1")
    expect(within(vem).getByRole("link")).toHaveTextContent("Internet · dia 20 · Moradia")
    expect(screen.getByText("Passou da renda")).toBeInTheDocument()

    // Faturas: à parte, com quando vence, de quando são as compras e o que falta pagar.
    const faturas = screen.getByRole("list", { name: "Faturas a pagar este mês" })
    const [inter, nubank] = within(faturas).getAllByRole("listitem")
    expect(inter).toHaveTextContent("Inter · venceu 12/9 · compras de 5/8 a 4/9")
    expect(inter).toHaveTextContent("Atrasada")
    expect(nubank).toHaveTextContent("Nubank · vence dia 10 · compras de 3/9 a 2/10")
    expect(nubank).toHaveTextContent("R$ 1.000,00 de R$ 1.200,00")
    expect(within(nubank).getByRole("link")).toHaveAttribute("href", "/cartoes/nubank")
    expect(screen.getByText(/Faturas a pagar este mês/)).toHaveTextContent("R$ 1.150,00")

    // Parcelas já compradas: os 3 próximos meses e o resto junto.
    const parcelas = screen.getByRole("list", { name: "Parcelas já compradas pros próximos meses" })
    expect(within(parcelas).getAllByRole("listitem").map((l) => l.textContent?.replace(/\u00a0/g, " "))).toEqual([
      "novembro de 2026R$ 1.000,00", "dezembro de 2026R$ 1.000,00", "janeiro de 2027R$ 1.000,00", "depois, até fevereiro de 2027R$ 1.000,00",
    ])
    expect(screen.getByText(/Parcelas já compradas pros próximos meses/, { selector: "span" })).toHaveTextContent("R$ 4.000,00")
  })

  it("a resposta leva pra ação", async () => {
    const user = userEvent.setup()
    renderizar(base)
    expect(screen.getByText(/Saiu mais do que entrou/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Classificar lançamentos" }))
    expect(screen.getByText("em /transacoes")).toBeInTheDocument()
  })

  it("sobrando: mostra o livre e não mostra a marca; recebido menor que o esperado aparece", () => {
    renderizar({
      ...base, rendaRecebida: 1000, rendaEsperada: 3000, rendaBase: 3000, jaSaiu: 1000, aindaVemTotal: 99.9, livre: 1900.1, percentualUsado: 36.7,
      jaSaiuPorCategoria: [{ categoriaId: "moradia", nome: "Moradia", valor: 1000, percentualDaRenda: 33.3 }],
      resposta: { tom: "positivo", texto: "Fecha o mês com R$ 1.900,10 sobrando, contando o que ainda entra e sai.", acoes: [] },
      faturas: [], faturasAPagar: 0, parcelasFuturas: { total: 0, ateAno: null, ateMes: null, porMes: [] },
    })
    expect(screen.queryByText(/Parcelas já compradas/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Faturas a pagar/)).not.toBeInTheDocument()
    expect(screen.getByText("Livre")).toBeInTheDocument()
    expect(screen.queryByText("sua renda")).not.toBeInTheDocument()
    expect(screen.getByText(/Recebeu/)).toHaveTextContent("Recebeu R$ 1.000,00 de R$ 3.000,00 esperados")
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("sem renda: mostra o gasto e pede a renda", () => {
    renderizar({
      ...base, rendaEsperada: 0, rendaRecebida: 0, rendaBase: 0, livre: -6177.03, percentualUsado: 0,
      resposta: { tom: "neutro", texto: "Diga quanto você espera receber por mês pra saber se o mês fecha.", acoes: [{ rotulo: "Dizer a renda", para: "/renda" }] },
    })
    expect(screen.getByText(/Gastou/)).toHaveTextContent("Gastou R$ 6.077,13")
    expect(screen.queryByText("Passou da renda")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Dizer a renda" })).toBeInTheDocument()
  })
})
