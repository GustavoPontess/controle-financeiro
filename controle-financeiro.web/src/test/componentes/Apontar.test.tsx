import { afterEach, describe, expect, it, vi } from "vitest"
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

vi.mock("html-to-image", () => ({ toJpeg: vi.fn(async () => "data:image/jpeg;base64,AAAA") }))
vi.mock("../../services/solicitacaoService", () => ({
  enviarSolicitacao: vi.fn(async (d: object) => ({ id: "s1", status: 0, criadoEm: "2026-10-29T12:00:00Z", ...d })),
}))
import { enviarSolicitacao } from "../../services/solicitacaoService"
import Apontar, { mascarar } from "../../componentes/Apontar"
import { abrirSolicitacao, descartarRascunho } from "../../estado/apontar"

function Tela() {
  return (
    <MemoryRouter initialEntries={["/relatorios"]}>
      <header><h1>Relatórios</h1></header>
      <main>
        <section><h2>Distribuição da renda</h2><p>Sobrou R$ 1.632,03</p><button type="button" onClick={() => { throw new Error("o app não pode receber o clique") }}>Ver</button></section>
      </main>
      <Apontar />
    </MemoryRouter>
  )
}

const abrir = async () => { act(() => abrirSolicitacao()); return screen.findByRole("dialog") }
/** No formulário: "+ Anexar" abre o menu com Print da tela / Apontar um bloco. */
const anexar = async (opcao: "Print da tela" | "Apontar um bloco") => {
  await userEvent.click(screen.getByRole("button", { name: "Anexar da tela" }))
  await userEvent.click(screen.getByRole("menuitem", { name: opcao }))
}

afterEach(() => { act(() => descartarRascunho()); vi.clearAllMocks() })

describe("Apontar (selo Beta)", () => {
  it("esconde valores do texto do bloco", () => {
    expect(mascarar("Sobrou -R$ 1.632,03 na conta 54675255-1 em 12 meses")).toBe("Sobrou -R$ •••• na conta •••• em 12 meses")
  })

  it("o selo abre o formulário direto; enviar sem título é barrado", async () => {
    render(<Tela />)
    await abrir()
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }))
    expect(screen.getByText("Dê um título")).toBeInTheDocument()
    expect(enviarSolicitacao).not.toHaveBeenCalled()
  })

  it("Apontar: escolhe o bloco (o clique não chega no app) e volta pro formulário com a miniatura dele", async () => {
    render(<Tela />)
    await abrir()
    await userEvent.type(screen.getByRole("textbox", { name: "Título" }), "Soma errada")
    await anexar("Apontar um bloco")
    expect(screen.getByText(/no que está errado ou no que podia melhorar/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Ver" })) // o onClick do app lançaria erro se recebesse

    expect(await screen.findByRole("img", { name: "Distribuição da renda (Relatórios)" })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Título" })).toHaveValue("Soma errada")
  })

  it("Print entra como miniatura e o × tira", async () => {
    render(<Tela />)
    await abrir()
    await anexar("Print da tela")
    expect(await screen.findByRole("img", { name: "Print de Relatórios" })).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Tirar Print de Relatórios" }))
    expect(screen.queryByRole("img", { name: "Print de Relatórios" })).not.toBeInTheDocument()
  })

  it("fechar (×) com algo escrito pergunta; Navegar e anexar depois recolhe pra barra; anexa dali e Abrir volta com tudo", async () => {
    render(<Tela />)
    await abrir()
    await userEvent.type(screen.getByRole("textbox", { name: "Título" }), "Fatura no topo")
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }))
    await userEvent.click(screen.getByRole("button", { name: "Navegar e anexar depois" }))

    const barra = await screen.findByRole("region", { name: "Solicitação em andamento" })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Print" }))
    await waitFor(() => expect(barra).toHaveTextContent("1 anexo"))

    await userEvent.click(screen.getByRole("button", { name: "Abrir" }))
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Título" })).toHaveValue("Fatura no topo")
    expect(screen.getByRole("img", { name: "Print de Relatórios" })).toBeInTheDocument()
  })

  it("envia título, descrição e os anexos; o texto do bloco vai mascarado com Esconder e cru com Mostrar", async () => {
    render(<Tela />)
    await abrir()
    await userEvent.click(screen.getByRole("radio", { name: "Melhoria" }))
    await userEvent.type(screen.getByRole("textbox", { name: "Título" }), "Fatura no topo")
    await userEvent.type(screen.getByRole("textbox", { name: /Conte mais/ }), "Sem abrir Cartões")
    await anexar("Apontar um bloco")
    fireEvent.click(screen.getByText("Sobrou R$ 1.632,03"))
    await screen.findByRole("img", { name: /Distribuição da renda/ })
    await userEvent.click(screen.getByRole("switch", { name: "Mostrar meus valores nos anexos" }))
    expect(screen.getByText(/Os próximos anexos vão com os seus valores/)).toBeInTheDocument()
    await anexar("Apontar um bloco")
    fireEvent.click(screen.getByText("Sobrou R$ 1.632,03"))
    await waitFor(() => expect(screen.getAllByRole("img", { name: /Distribuição da renda/ })).toHaveLength(2))
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }))

    expect(enviarSolicitacao).toHaveBeenCalledWith(expect.objectContaining({
      tipo: 2, titulo: "Fatura no topo", descricao: "Sem abrir Cartões", tela: "/relatorios",
      anexos: [
        expect.objectContaining({ tipo: 2, bloco: "Distribuição da renda", mostrarValores: false, textoDoBloco: expect.stringContaining("R$ ••••") }),
        expect.objectContaining({ tipo: 2, mostrarValores: true, textoDoBloco: expect.stringContaining("R$ 1.632,03"), imagemBase64: "data:image/jpeg;base64,AAAA" }),
      ],
    }))
    expect(await screen.findByText(/A gente lê tudo que chega por aqui/)).toBeInTheDocument()
  })

  it("Esc no modo apontar volta pro formulário sem perder o título", async () => {
    render(<Tela />)
    await abrir()
    await userEvent.type(screen.getByRole("textbox", { name: "Título" }), "Algo estranho")
    await anexar("Apontar um bloco")
    fireEvent.keyDown(document, { key: "Escape" })
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Título" })).toHaveValue("Algo estranho")
  })

  it("fechar sem nada escrito só fecha (sem barra); com algo, Continuar volta e Descartar joga fora", async () => {
    render(<Tela />)
    await abrir()
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }))
    expect(screen.queryByRole("region", { name: "Solicitação em andamento" })).not.toBeInTheDocument()

    await abrir()
    await userEvent.type(screen.getByRole("textbox", { name: "Título" }), "Vai pro lixo")
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }))
    await userEvent.click(screen.getByRole("button", { name: "Continuar escrevendo" }))
    expect(screen.getByRole("textbox", { name: "Título" })).toHaveValue("Vai pro lixo")
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }))
    await userEvent.click(screen.getByRole("button", { name: "Descartar" }))
    await abrir()
    expect(screen.getByRole("textbox", { name: "Título" })).toHaveValue("")
  })

  it("tocar na miniatura abre a imagem grande; Esc fecha só ela", async () => {
    render(<Tela />)
    await abrir()
    await anexar("Print da tela")
    await userEvent.click(await screen.findByRole("button", { name: "Ver Print de Relatórios" }))
    expect(screen.getByRole("dialog", { name: /Anexo 1 de 1/ })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("dialog", { name: /Anexo 1 de 1/ })).not.toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "Contar um problema" })).toBeInTheDocument()
  })
})
