import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import type { Conta } from "../../types/Conta"
import type { ReconciliacaoMarco } from "../../types/Reconciliacao"

const CONTAS: Conta[] = [
  { id: "k0", nome: "Carteira", saldoAtual: 50, tipo: 4, tipoDescricao: "", isCarteira: true },
  { id: "k1", nome: "Nubank", saldoAtual: 1200, tipo: 1, tipoDescricao: "", isCarteira: false },
]
const marco = (id: string, dia: string, extra: Partial<ReconciliacaoMarco> = {}): ReconciliacaoMarco => ({
  id, contaId: "k1", dataHora: `${dia}T23:59:00.000Z`, saldoDeclarado: 1200, saldoCalculado: 1200, diferenca: 0, tipo: 2, temAjuste: false, criadoEm: dia, ...extra,
})
let marcos: ReconciliacaoMarco[] = []
let calculado = 1200
vi.mock("../../services/contaService", () => ({ getContas: vi.fn(async () => CONTAS) }))
vi.mock("../../services/reconciliacaoService", () => ({
  listMarcos: vi.fn(async () => marcos),
  getSaldoCalculado: vi.fn(async () => calculado),
  criarMarco: vi.fn(async (dto: { saldoDeclarado: number }) => marco("novo", "2026-10-18", { saldoDeclarado: dto.saldoDeclarado, diferenca: dto.saldoDeclarado - calculado })),
  fecharDiferenca: vi.fn(async () => marco("m1", "2026-10-10", { temAjuste: true })),
  removerMarco: vi.fn(async () => {}),
}))
import { criarMarco, fecharDiferenca, removerMarco } from "../../services/reconciliacaoService"
import Reconciliacao from "../../telas/Reconciliacao"

const Transacoes = () => { const { state } = useLocation(); return <p>transações {JSON.stringify(state)}</p> }
const renderizar = () => render(
  <MemoryRouter initialEntries={["/reconciliacao"]}>
    <Routes>
      <Route path="/reconciliacao" element={<Reconciliacao />} />
      <Route path="/transacoes" element={<Transacoes />} />
      <Route path="/transacoes/nova" element={<p>nova transação</p>} />
      <Route path="/bancos/:id/editar" element={<p>editar conta</p>} />
    </Routes>
  </MemoryRouter>,
)
const lista = () => screen.getByRole("list", { name: "Conferências" })
const linha = (nome: RegExp) => within(lista()).getByRole("button", { name: nome })

describe("Reconciliação", () => {
  beforeEach(() => { vi.clearAllMocks(); marcos = []; calculado = 1200; localStorage.clear() })

  it("abre na conta com saldo (não na carteira), mostra o saldo no app e, sem o saldo do banco, bloqueia o salvar", async () => {
    renderizar()
    expect(await screen.findByRole("combobox", { name: "Conta" })).toHaveTextContent("Nubank")
    expect(screen.getByText("Saldo no app").nextSibling).toHaveTextContent("1.200,00")
    expect(await screen.findByText("Nenhuma ainda")).toBeInTheDocument()
    expect(screen.getByText("Nenhuma conferência nesta conta. Diga o saldo que está no banco e o app confere.")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Salvar conferência" }))
    expect(screen.getByText("Digite o saldo que está no banco.")).toBeInTheDocument()
    expect(criarMarco).not.toHaveBeenCalled()
  })

  it("digitar o saldo do banco mostra a diferença ao vivo e salvar grava o marco com chave de idempotência", async () => {
    renderizar()
    await screen.findByRole("combobox", { name: "Conta" })
    const comparacao = await screen.findByLabelText("Comparação")
    // O saldo do app chega do servidor; a diferença só aparece depois dele.
    await within(comparacao).findByText(/1\.200,00/)
    await userEvent.type(screen.getByRole("textbox", { name: "Saldo no banco" }), "108000")
    await within(comparacao).findByText(/120,00/)
    expect(screen.getByText(/O banco tem menos que o app/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Salvar conferência" }))
    expect(criarMarco).toHaveBeenCalledWith(
      expect.objectContaining({ contaId: "k1", saldoDeclarado: 1080, tipo: 2, dataHora: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) }),
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    )
    // Depois de salvar, o campo limpa e a lista recarrega.
    expect(screen.getByRole("textbox", { name: "Saldo no banco" })).toHaveValue("")
  })

  it("marco com diferença: a ficha recalcula agora e oferece Ajustar, Lançar o que falta e Ver lançamentos", async () => {
    marcos = [
      marco("m1", "2026-10-10", { saldoDeclarado: 1080, saldoCalculado: 1200, diferenca: -120 }),
      marco("m0", "2026-10-01", { tipo: 1, derivado: true, saldoDeclarado: 500, saldoCalculado: 500 }),
    ]
    renderizar()
    await screen.findByRole("list", { name: "Conferências" })
    expect(screen.getByText("Última conferência").nextSibling).toHaveTextContent("10/10/2026")
    expect(linha(/10\/10\/2026/)).toHaveTextContent("Diferença")
    expect(linha(/01\/10\/2026/)).toHaveTextContent("Ponto de partida")

    await userEvent.click(linha(/10\/10\/2026/))
    expect(await screen.findByRole("button", { name: "Ajustar" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Ver lançamentos" }))
    expect(screen.getByText(/transações/)).toHaveTextContent('"contaId":"k1","de":"2026-10-01","ate":"2026-10-10"')
  })

  it("Ajustar fecha a diferença no servidor; Remover pede confirmação", async () => {
    marcos = [marco("m1", "2026-10-10", { saldoDeclarado: 1080, saldoCalculado: 1200, diferenca: -120 })]
    renderizar()
    await screen.findByRole("list", { name: "Conferências" })
    await userEvent.click(linha(/10\/10\/2026/))
    await userEvent.click(await screen.findByRole("button", { name: "Ajustar" }))
    expect(fecharDiferenca).toHaveBeenCalledWith("m1", expect.stringMatching(/^[0-9a-f-]{36}$/))

    await userEvent.click(linha(/10\/10\/2026/))
    await userEvent.click(await screen.findByRole("button", { name: "Remover" }))
    const dialogo = await screen.findByRole("alertdialog")
    expect(dialogo).toHaveTextContent("Remover esta conferência?")
    await userEvent.click(within(dialogo).getByRole("button", { name: "Remover" }))
    expect(removerMarco).toHaveBeenCalledWith("m1")
  })

  it("marco salvo com diferença que passou a bater (lançou o que faltava): só confirmar", async () => {
    marcos = [marco("m1", "2026-10-10", { saldoDeclarado: 1080, saldoCalculado: 1200, diferenca: -120, saldoCalculadoAgora: 1080, diferencaAgora: 0 })]
    renderizar()
    await screen.findByRole("list", { name: "Conferências" })
    await userEvent.click(linha(/10\/10\/2026/))
    await userEvent.click(await screen.findByRole("button", { name: "Agora bate: confirmar" }))
    expect(fecharDiferenca).toHaveBeenCalledWith("m1", expect.any(String))
    expect(screen.queryByRole("button", { name: "Ajustar" })).not.toBeInTheDocument()
  })

  it("marco que bateu e deixou de bater (lançaram algo com data antes dele): a linha diz Diferença, não Bateu", async () => {
    marcos = [marco("m1", "2026-10-08", { saldoDeclarado: 1139.96, saldoCalculado: 1139.96, diferenca: 0, saldoCalculadoAgora: 539.96, diferencaAgora: 600 })]
    renderizar()
    await screen.findByRole("list", { name: "Conferências" })
    expect(linha(/08\/10\/2026/)).toHaveTextContent("Diferença")
    expect(linha(/08\/10\/2026/)).not.toHaveTextContent("Bateu")
    await userEvent.click(linha(/08\/10\/2026/))
    expect(screen.getByText("No app").nextSibling).toHaveTextContent("539,96")
    expect(await screen.findByRole("button", { name: "Ajustar" })).toBeInTheDocument()
  })

  it("ponto de partida (saldo inicial): sem Remover, com Editar saldo inicial", async () => {
    marcos = [marco("m0", "2026-10-01", { tipo: 1, derivado: true, saldoDeclarado: 500, saldoCalculado: 500 })]
    renderizar()
    await screen.findByRole("list", { name: "Conferências" })
    await userEvent.click(linha(/01\/10\/2026/))
    expect(screen.queryByRole("button", { name: "Remover" })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Editar saldo inicial" }))
    expect(screen.getByText("editar conta")).toBeInTheDocument()
  })
})
