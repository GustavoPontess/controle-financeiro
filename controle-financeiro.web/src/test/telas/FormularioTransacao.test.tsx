import { describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import userEvent from "@testing-library/user-event"

vi.mock("../../services/transactionService", () => ({ createTransaction: vi.fn(), updateTransaction: vi.fn(), avisoDeCompra: vi.fn(async () => null) }))
vi.mock("../../services/transferenciaService", () => ({ createTransferencia: vi.fn(), editarTransferencia: vi.fn() }))
vi.mock("../../services/familiaService", () => ({ getFamilias: vi.fn(async () => []), getFamilia: vi.fn() }))
import { getFamilia, getFamilias } from "../../services/familiaService"
import { avisoDeCompra, createTransaction, updateTransaction } from "../../services/transactionService"
import { createTransferencia, editarTransferencia } from "../../services/transferenciaService"
import FormularioTransacao from "../../telas/FormularioTransacao"

const contas = [
  { id: "k1", nome: "Carteira", tipo: 4, tipoDescricao: "", saldoAtual: 0, isCarteira: true },
  { id: "k2", nome: "Nubank", tipo: 1, tipoDescricao: "", saldoAtual: 0, isCarteira: false },
]
const categorias = [{ id: "cat1", descricao: "Alimentação", finalidade: 1, isPadrao: true }]
// Despesa já lançada, com hora (pra provar que dá pra tirar a hora ao editar). Antes do dia congelado do setup (20/10).
const despesaComHora = {
  id: "t1", descricao: "Feira", valor: 50, tipo: 1, data: "2026-10-15", hora: "10:00:00", contaId: "k1", contaNome: "Carteira",
  categoriaId: "cat1" as string | null, statusTransacao: 1, meioPagamento: 4,
}
const renderizar = () => render(
  <FormularioTransacao contas={contas as never} cartoes={[]} categorias={categorias as never} subcategorias={[]} aoSair={vi.fn()} aoSalvo={vi.fn()} />,
)

describe("FormularioTransacao", () => {
  it("submit vazio bloqueia e mostra o erro em cada campo", async () => {
    renderizar()
    await userEvent.click(screen.getByRole("button", { name: "Adicionar" }))
    expect(screen.getByText("Informe um valor")).toBeInTheDocument()
    expect(screen.getByText("Informe a descrição")).toBeInTheDocument()
    // O erro mora no <small> do campo (o mesmo texto aparece como placeholder da seleção).
    expect(screen.getByText("Escolha a conta", { selector: "small > span" })).toBeInTheDocument()
    expect(screen.getByText("Escolha a categoria", { selector: "small > span" })).toBeInTheDocument()
    expect(createTransaction).not.toHaveBeenCalled()
  })

  it("o erro some ao corrigir o campo", async () => {
    renderizar()
    await userEvent.click(screen.getByRole("button", { name: "Adicionar" }))
    await userEvent.type(screen.getByPlaceholderText("Mercado"), "Feira")
    expect(screen.queryByText("Informe a descrição")).not.toBeInTheDocument()
  })

  it("conta fixa não entra aqui: sem interruptor nem atalho (tem formulário próprio)", () => {
    renderizar()
    expect(screen.queryByRole("switch", { name: "Conta fixa" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /conta fixa/i })).not.toBeInTheDocument()
  })

  it("receita não oferece débito automático nem crédito", async () => {
    renderizar()
    await userEvent.click(screen.getByRole("radio", { name: "Receita" }))
    await userEvent.click(screen.getByRole("combobox", { name: "Recebido por" }))
    const opcoes = screen.getAllByRole("option").map((o) => o.textContent)
    expect(opcoes).not.toContain("Débito automático")
    expect(opcoes).not.toContain("Crédito")
  })

  it("transferência pede origem e destino", async () => {
    renderizar()
    await userEvent.click(screen.getByRole("radio", { name: "Transferência" }))
    await userEvent.click(screen.getByRole("button", { name: "Transferir" }))
    expect(screen.getByText("Escolha a conta de origem")).toBeInTheDocument()
    expect(screen.getByText("Escolha a conta de destino")).toBeInTheDocument()
    expect(createTransferencia).not.toHaveBeenCalled()
  })

  // Regra do formulário: o que é obrigatório pra criar é pra editar. Hora é opcional nos dois.
  it("hora é opcional ao criar e ao editar: sem hora salva com hora null", async () => {
    const { unmount } = renderizar()
    await userEvent.click(screen.getByRole("radio", { name: "Transferência" }))
    await userEvent.type(screen.getByPlaceholderText("0,00"), "5000")
    await userEvent.type(screen.getByPlaceholderText("Reserva de emergência"), "Guardar")
    await userEvent.click(screen.getByRole("combobox", { name: "De" }))
    await userEvent.click(screen.getByRole("option", { name: "Carteira" }))
    await userEvent.click(screen.getByRole("combobox", { name: "Para" }))
    await userEvent.click(screen.getByRole("option", { name: "Nubank" }))
    await userEvent.clear(screen.getByPlaceholderText("HH:MM"))
    expect(screen.getByText("Hora (opcional)")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Transferir" }))
    await waitFor(() => expect(createTransferencia).toHaveBeenCalledWith(expect.objectContaining({ hora: null }), expect.any(String)))
    unmount()

    render(<FormularioTransacao transacao={despesaComHora as never} contas={contas as never} cartoes={[]} categorias={categorias as never} subcategorias={[]} aoSair={vi.fn()} aoSalvo={vi.fn()} />)
    await userEvent.clear(screen.getByPlaceholderText("HH:MM"))
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(updateTransaction).toHaveBeenCalledWith("t1", expect.objectContaining({ hora: null }), expect.any(String)))
    expect(screen.queryByText(/Informe a hora/)).toBeNull()
  })

  it("editar transferência: abre com as contas dela, sem trocar o tipo, e salva a transferência inteira", async () => {
    vi.mocked(editarTransferencia).mockResolvedValue({} as never)
    const aoSalvo = vi.fn()
    const perna = { ...despesaComHora, id: "perna1", descricao: "Reserva", ehTransferencia: true, categoriaId: null }
    render(<FormularioTransacao transacao={perna as never} transferenciaEditada={{ id: "tf1", contaOrigemId: "k1", contaDestinoId: "k2" }}
      contas={contas as never} cartoes={[]} categorias={categorias as never} subcategorias={[]} aoSair={vi.fn()} aoSalvo={aoSalvo} />)

    expect(screen.queryByRole("radio", { name: "Despesa" })).toBeNull()
    expect(screen.getByRole("combobox", { name: "De" })).toHaveTextContent("Carteira")
    expect(screen.getByRole("combobox", { name: "Para" })).toHaveTextContent("Nubank")
    const valor = screen.getByPlaceholderText("0,00")
    await userEvent.clear(valor)
    await userEvent.type(valor, "7550")
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))

    await waitFor(() => expect(editarTransferencia).toHaveBeenCalledWith("tf1",
      { contaOrigemId: "k1", contaDestinoId: "k2", valor: 75.5, data: "2026-10-15", hora: "10:00:00", descricao: "Reserva" }))
    expect(updateTransaction).not.toHaveBeenCalledWith("perna1", expect.anything(), expect.anything())
    expect(aoSalvo).toHaveBeenCalledWith(undefined)
  })

  it("despesa nova mostra o aviso do servidor quando a compra aperta uma conta fixa", async () => {
    vi.mocked(avisoDeCompra).mockResolvedValue({
      tom: "alerta", texto: "Se fizer essa compra, falta saldo na conta Nubank pra:", detalhe: "Saldo da conta hoje: R$ 200,00.",
      itens: [
        { transacaoId: "t1", contaFixaId: "cf1", descricao: "Internet", data: "2099-01-20", categoriaId: null, categoria: "", valor: 99.9 },
        { transacaoId: "t2", contaFixaId: "cf2", descricao: "Aluguel", data: "2099-02-05", categoriaId: null, categoria: "", valor: 1500 },
      ],
    })
    render(
      <MemoryRouter>
        <FormularioTransacao contas={contas as never} cartoes={[]} categorias={categorias as never} subcategorias={[]} aoSair={vi.fn()} aoSalvo={vi.fn()} />
      </MemoryRouter>,
    )
    await userEvent.type(screen.getByPlaceholderText("0,00"), "30000")
    await userEvent.click(screen.getByRole("combobox", { name: "Conta" }))
    await userEvent.click(screen.getByRole("option", { name: "Nubank" }))

    expect(await screen.findByText("Se fizer essa compra, falta saldo na conta Nubank pra:")).toBeInTheDocument()
    // As contas uma por linha (sem link: sair do formulário perderia o que foi digitado) e o saldo de hoje no fim.
    const linhas = screen.getAllByRole("listitem").map((li) => li.textContent?.replace(/ /g, " "))
    expect(linhas).toEqual(["Internet · 20/1R$ 99,90", "Aluguel · 5/2R$ 1.500,00"])
    expect(screen.queryByRole("link", { name: /Internet/ })).toBeNull()
    expect(screen.getByText(/^Saldo da conta hoje: R\$\s200,00\.$/)).toBeInTheDocument()
    await waitFor(() => expect(avisoDeCompra).toHaveBeenLastCalledWith(300, { contaId: "k2" }))
  })

  it("despesa nova divide com a família ao salvar: o interruptor manda a família e diz como divide", async () => {
    vi.mocked(getFamilias).mockResolvedValue([{ id: "f1", nome: "Casa Pontes", criadoPorUsuarioId: "u1", criadoEm: "2026-01-01", ehAdmin: true, totalMembros: 3 }])
    vi.mocked(getFamilia).mockResolvedValue({
      id: "f1", nome: "Casa Pontes", criadoPorUsuarioId: "u1", criadoEm: "2026-01-01", ehAdmin: true, modoRateioPadrao: 1, limiteAprovacao: null, convitesPendentes: [],
      membros: [
        { id: "m1", usuarioId: "u1", nomeUsuario: "Gustavo Pontes", emailUsuario: "", papel: "", entrouEm: "", papelPermissao: 1, visibilidadeRenda: 1, rendaVisivelPara: [] },
        { id: "m2", usuarioId: "u2", nomeUsuario: "Gabriel Dev", emailUsuario: "", papel: "", entrouEm: "", papelPermissao: 2, visibilidadeRenda: 1, rendaVisivelPara: null },
        { id: "m3", usuarioId: "u3", nomeUsuario: "Marina Dev", emailUsuario: "", papel: "", entrouEm: "", papelPermissao: 3, visibilidadeRenda: 0, rendaVisivelPara: null },
      ],
    } as never)
    vi.mocked(createTransaction).mockResolvedValue({} as never)
    render(<MemoryRouter><FormularioTransacao contas={contas as never} cartoes={[]} categorias={categorias as never} subcategorias={[]} aoSair={vi.fn()} aoSalvo={vi.fn()} /></MemoryRouter>)

    await userEvent.type(screen.getByPlaceholderText("0,00"), "12000")
    await userEvent.type(screen.getByPlaceholderText("Mercado"), "Mercado")
    await userEvent.click(screen.getByRole("combobox", { name: "Conta" }))
    await userEvent.click(screen.getByRole("option", { name: "Nubank" }))
    await userEvent.click(screen.getByRole("combobox", { name: "Categoria" }))
    await userEvent.click(screen.getByRole("option", { name: "Alimentação" }))
    await userEvent.click(await screen.findByRole("switch", { name: "Dividir com Casa Pontes" }))
    // Quem só vê (Marina) fica fora da divisão.
    expect(await screen.findByText("Igual entre Gustavo e Gabriel")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Adicionar" }))
    await waitFor(() => expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({ familiaId: "f1", valor: 120 }), expect.any(String)))
  })

  it("sem família não aparece o interruptor; receita também não divide", async () => {
    vi.mocked(getFamilias).mockResolvedValue([])
    renderizar()
    await waitFor(() => expect(getFamilias).toHaveBeenCalled())
    expect(screen.queryByRole("switch", { name: /Dividir/ })).not.toBeInTheDocument()
  })
})
