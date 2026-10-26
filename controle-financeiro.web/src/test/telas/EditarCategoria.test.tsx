import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"

vi.mock("../../services/categoryService", () => ({
  createCategory: vi.fn(async (d: { descricao: string; finalidade: number }) => ({ id: "nova", isPadrao: false, ...d })),
  updateCategory: vi.fn(async (id: string, d: { descricao: string; finalidade: number }) => ({ id, isPadrao: false, ...d })),
  getCategory: vi.fn(async (id: string) => ({ id, descricao: id === "padrao" ? "Moradia" : "Pets", finalidade: 1, isPadrao: id === "padrao" })),
}))
vi.mock("../../services/subcategoryService", () => ({
  createSubcategory: vi.fn(async () => ({})),
  updateSubcategory: vi.fn(async () => ({})),
  getSubcategory: vi.fn(async () => ({ id: "s1", nome: "Ração", categoriaId: "c2", isPadrao: false, cor: "#AA0000" })),
}))
import { createCategory, updateCategory } from "../../services/categoryService"
import { createSubcategory, updateSubcategory } from "../../services/subcategoryService"
import EditarCategoria from "../../telas/EditarCategoria"
import EditarSubcategoria from "../../telas/EditarSubcategoria"

const ListaCategorias = () => <p>lista de categorias</p>
const renderizar = (rota: string, state?: unknown) => render(
  <MemoryRouter initialEntries={[{ pathname: rota, state }]}>
    <Routes>
      <Route path="/categorias" element={<ListaCategorias />} />
      <Route path="/categorias/nova" element={<EditarCategoria />} />
      <Route path="/categorias/:id/editar" element={<EditarCategoria />} />
      <Route path="/categorias/:id/subcategorias/nova" element={<EditarSubcategoria nova />} />
      <Route path="/subcategorias/:id/editar" element={<EditarSubcategoria />} />
    </Routes>
  </MemoryRouter>,
)

describe("EditarCategoria", () => {
  beforeEach(() => { vi.mocked(createCategory).mockClear(); vi.mocked(updateCategory).mockClear() })

  it("submit vazio bloqueia e mostra o erro no nome", async () => {
    renderizar("/categorias/nova")
    await userEvent.click(screen.getByRole("button", { name: "Criar categoria" }))
    expect(screen.getByText("Informe o nome")).toBeInTheDocument()
    expect(createCategory).not.toHaveBeenCalled()
  })

  it("cria com o tipo da aba de onde veio e volta pra lista", async () => {
    renderizar("/categorias/nova", { tipo: 2 })
    expect(screen.getByRole("radio", { name: "Receita", checked: true })).toBeInTheDocument()
    await userEvent.type(screen.getByPlaceholderText("Pets"), "  Freelas ")
    await userEvent.click(screen.getByRole("button", { name: "Criar categoria" }))
    expect(createCategory).toHaveBeenCalledWith({ descricao: "Freelas", finalidade: 2 })
    expect(await screen.findByText("lista de categorias")).toBeInTheDocument()
  })

  it("nome repetido (409) volta no campo, não no topo", async () => {
    vi.mocked(createCategory).mockRejectedValueOnce({ response: { status: 409, data: { message: "Já existe uma categoria com esse nome." } } })
    renderizar("/categorias/nova")
    await userEvent.type(screen.getByPlaceholderText("Pets"), "Moradia")
    await userEvent.click(screen.getByRole("button", { name: "Criar categoria" }))
    expect(await screen.findByText("Já existe uma categoria com esse nome.", { selector: "small > span" })).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("editar: vem preenchida e manda o PUT; padrão não abre", async () => {
    renderizar("/categorias/c2/editar")
    expect(await screen.findByDisplayValue("Pets")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("radio", { name: "As duas" }))
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect(updateCategory).toHaveBeenCalledWith("c2", { descricao: "Pets", finalidade: 3 })
  })

  it("categoria padrão: avisa e não mostra o formulário", async () => {
    renderizar("/categorias/padrao/editar")
    expect(await screen.findByRole("alert")).toHaveTextContent("Categoria padrão não pode ser alterada.")
    expect(screen.queryByPlaceholderText("Pets")).not.toBeInTheDocument()
  })
})

describe("EditarSubcategoria", () => {
  it("nova: mostra a categoria fixa e cria nela", async () => {
    renderizar("/categorias/c2/subcategorias/nova")
    expect(await screen.findByText("Pets")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Criar subcategoria" }))
    expect(screen.getByText("Informe o nome")).toBeInTheDocument()
    await userEvent.type(screen.getByPlaceholderText("Ração"), "Veterinário")
    await userEvent.click(screen.getByRole("button", { name: "Criar subcategoria" }))
    expect(createSubcategory).toHaveBeenCalledWith({ nome: "Veterinário", categoriaId: "c2" })
  })

  it("editar: mantém a cor que já tinha", async () => {
    renderizar("/subcategorias/s1/editar")
    const nome = await screen.findByDisplayValue("Ração")
    await userEvent.clear(nome); await userEvent.type(nome, "Ração premium")
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect(updateSubcategory).toHaveBeenCalledWith("s1", { nome: "Ração premium", cor: "#AA0000", icone: null })
  })
})
