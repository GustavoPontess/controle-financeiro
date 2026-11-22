import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"

vi.mock("../../services/contaService", () => ({
  getContas: vi.fn(async () => [{ id: "k1", nome: "Nubank", tipo: 1, tipoDescricao: "", saldoAtual: 0, isCarteira: false }]),
}))
vi.mock("../../services/categoryService", () => ({ getCategories: vi.fn(async () => []) }))
vi.mock("../../services/subcategoryService", () => ({ getSubcategories: vi.fn(async () => []) }))
vi.mock("../../services/cartaoCreditoService", () => ({
  getCartoes: vi.fn(async () => [
    { id: "c1", nome: "Nubank Roxinho", bandeira: 1, bandeiraDescricao: "", temCredito: true, temDebito: false, ehPrePago: false, ativo: true },
    { id: "c2", nome: "Só débito", bandeira: 1, bandeiraDescricao: "", temCredito: false, temDebito: true, ehPrePago: false, ativo: true },
  ]),
}))
vi.mock("../../services/importacaoService", () => ({
  previewImportacao: vi.fn(), confirmarImportacao: vi.fn(), ensinarNome: vi.fn(), getImportacoesAnteriores: vi.fn(async () => []),
  getQuantidadePendentes: vi.fn(async () => 0), previewFatura: vi.fn(), confirmarFatura: vi.fn(),
}))
import { confirmarFatura, previewFatura } from "../../services/importacaoService"
import ImportarExtrato from "../../telas/ImportarExtrato"

const PREVIA = {
  compras: 4, valorCompras: 385.5, parcelamentos: 1, jaNoApp: 0, pagamentos: 2, creditos: 1, valorCreditos: 20, semCategoria: 5,
  faturas: [
    { vencimento: "2026-11-08", lancamentos: 3, compras: 325.5, situacao: "paga-pela-conta", pagoPelaConta: 325.5 },
    { vencimento: "2026-12-08", lancamentos: 3, compras: 160, situacao: "a-pagar", pagoPelaConta: 0 },
  ],
  arquivos: [{ nome: "Nubank_2026-11-08.csv", linhas: 4 }, { nome: "ruim.csv", linhas: 0, erro: "Não reconhecemos as colunas desse arquivo." }],
}

const renderizar = () => render(
  <MemoryRouter initialEntries={["/importar"]}>
    <Routes>
      <Route path="/importar" element={<ImportarExtrato />} />
      <Route path="/pendentes" element={<p>fila de pendentes</p>} />
    </Routes>
  </MemoryRouter>,
)
const escolherCartao = async () =>
  userEvent.click(within(await screen.findByRole("list", { name: "Contas" })).getByRole("button", { name: /Nubank Roxinho/ }))

describe("Importar a fatura do cartão", () => {
  beforeEach(() => { vi.mocked(previewFatura).mockReset(); vi.mocked(confirmarFatura).mockReset() })

  it("lista só cartão de crédito; sem arquivo não lê", async () => {
    renderizar()
    await escolherCartao()
    expect(screen.queryByRole("button", { name: /Só débito/ })).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Nubank Roxinho" })).toBeInTheDocument()
    // O campo só aceita .ofx/.csv; aqui alguém força outro arquivo (o filtro do navegador não é garantia).
    await userEvent.setup({ applyAccept: false }).upload(screen.getByLabelText("Arquivo da fatura"), new File(["x"], "fatura.pdf"))
    expect(await screen.findByText("fatura.pdf não é .ofx nem .csv")).toBeInTheDocument()
    expect(previewFatura).not.toHaveBeenCalled()
  })

  it("escolher o arquivo já lê; importar grava com a chave e leva pros pendentes", async () => {
    vi.mocked(previewFatura).mockResolvedValue(PREVIA as never)
    vi.mocked(confirmarFatura).mockResolvedValue({ compras: 4, parcelamentos: 1, jaNoApp: 0, pagamentosLigados: 1, faturasPagas: 0, semCategoria: 5 })
    renderizar()
    await escolherCartao()
    const arquivo = new File(["date,title,amount"], "Nubank_2026-11-08.csv")
    await userEvent.upload(screen.getByLabelText("Arquivo da fatura"), arquivo)

    expect(previewFatura).toHaveBeenCalledWith("c1", [arquivo])
    expect(await screen.findByText("Vence 08/11/2026")).toBeInTheDocument()
    expect(screen.getByText("Paga pela conta")).toBeInTheDocument()
    expect(screen.getByText("A pagar")).toBeInTheDocument()
    expect(screen.getByText(/ruim\.csv: Não reconhecemos/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Importar" }))
    const [cartao, enviados, chave] = vi.mocked(confirmarFatura).mock.calls[0]
    expect([cartao, enviados]).toEqual(["c1", [arquivo]])
    expect(chave).toMatch(/[0-9a-f-]{36}/)
    expect(await screen.findByRole("heading", { name: "5 compras importadas" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Resolver 5 pendentes" }))
    expect(await screen.findByText("fila de pendentes")).toBeInTheDocument()
  })

  it("nada novo: o botão diz e não importa", async () => {
    vi.mocked(previewFatura).mockResolvedValue({ ...PREVIA, compras: 0, parcelamentos: 0, jaNoApp: 6 } as never)
    renderizar()
    await escolherCartao()
    await userEvent.upload(screen.getByLabelText("Arquivo da fatura"), new File(["x"], "nu.csv"))
    expect(await screen.findByRole("button", { name: "Nada novo pra importar" })).toBeDisabled()
  })
})
