import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"

const CATS = [
  { id: "pets", descricao: "Pets", finalidade: 1, isPadrao: false },
  { id: "compras", descricao: "Compras", finalidade: 1, isPadrao: true },
  { id: "salario", descricao: "Salário", finalidade: 2, isPadrao: true },
  { id: "vazia", descricao: "Vazia", finalidade: 1, isPadrao: false },
]
const SEM_USO = { lancamentos: 0, contasFixas: 0, parcelamentos: 0, limites: 0, metas: 0, subcategorias: 0 }
vi.mock("../../services/categoryService", () => ({
  getCategories: vi.fn(async () => CATS),
  getCategory: vi.fn(async (id: string) => CATS.find((c) => c.id === id)),
  getUsoCategoria: vi.fn(async (id: string) => (id === "pets" ? { ...SEM_USO, lancamentos: 12, contasFixas: 1 } : SEM_USO)),
  deleteCategory: vi.fn(async () => {}),
}))
vi.mock("../../services/subcategoryService", () => ({
  getSubcategory: vi.fn(async () => ({ id: "racao", nome: "Ração", categoriaId: "pets", isPadrao: false })),
  getSubcategories: vi.fn(async () => [
    { id: "racao", nome: "Ração", categoriaId: "pets", isPadrao: false },
    { id: "vet", nome: "Veterinário", categoriaId: "pets", isPadrao: false },
  ]),
  getUsoSubcategoria: vi.fn(async () => ({ lancamentos: 3, contasFixas: 0 })),
  deleteSubcategory: vi.fn(async () => {}),
}))
import { deleteCategory } from "../../services/categoryService"
import { deleteSubcategory } from "../../services/subcategoryService"
import ExcluirCategoria from "../../telas/ExcluirCategoria"

const ListaCategorias = () => <p>lista de categorias</p>
const renderizar = (rota: string) => render(
  <MemoryRouter initialEntries={[rota]}>
    <Routes>
      <Route path="/categorias" element={<ListaCategorias />} />
      <Route path="/categorias/:id/excluir" element={<ExcluirCategoria />} />
      <Route path="/subcategorias/:id/excluir" element={<ExcluirCategoria sub />} />
    </Routes>
  </MemoryRouter>,
)

describe("ExcluirCategoria", () => {
  beforeEach(() => { vi.mocked(deleteCategory).mockClear(); vi.mocked(deleteSubcategory).mockClear() })

  it("em uso: obriga escolher o destino, só oferece as que aceitam o tipo e manda moverPara", async () => {
    renderizar("/categorias/pets/excluir")
    expect(await screen.findByText(/12 lançamentos · 1 conta fixa/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Excluir categoria" }))
    expect(screen.getByText("Escolha pra qual categoria vai")).toBeInTheDocument()
    expect(deleteCategory).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole("combobox", { name: "O que está nela vai pra" }))
    const opcoes = within(screen.getByRole("listbox")).getAllByRole("option").map((o) => o.textContent)
    expect(opcoes).toEqual(["Compras", "Vazia"]) // sem ela mesma e sem a de receita
    await userEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Compras" }))
    expect(screen.getByText("Compras", { selector: "strong" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Excluir categoria" }))
    expect(deleteCategory).toHaveBeenCalledWith("pets", "compras")
    expect(await screen.findByText("lista de categorias")).toBeInTheDocument()
  })

  it("sem uso: exclui direto, sem perguntar destino", async () => {
    renderizar("/categorias/vazia/excluir")
    expect(await screen.findByText("Nada usa essa categoria. Ela sai das listas.")).toBeInTheDocument()
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Excluir categoria" }))
    expect(deleteCategory).toHaveBeenCalledWith("vazia", undefined)
  })

  it("padrão: avisa e não oferece excluir", async () => {
    renderizar("/categorias/compras/excluir")
    expect(await screen.findByRole("alert")).toHaveTextContent("Categoria padrão não pode ser excluída.")
    expect(screen.queryByRole("button", { name: "Excluir categoria" })).not.toBeInTheDocument()
  })

  it("erro do servidor aparece no topo e libera o botão", async () => {
    vi.mocked(deleteCategory).mockRejectedValueOnce({ response: { status: 400, data: { message: "\"Compras\" é só de despesa e essa categoria tem receitas." } } })
    renderizar("/categorias/pets/excluir")
    await userEvent.click(await screen.findByRole("combobox", { name: "O que está nela vai pra" }))
    await userEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Compras" }))
    await userEvent.click(screen.getByRole("button", { name: "Excluir categoria" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("é só de despesa")
    expect(screen.getByRole("button", { name: "Excluir categoria" })).toBeEnabled()
  })
})

describe("ExcluirSubcategoria", () => {
  beforeEach(() => { vi.mocked(deleteSubcategory).mockClear() })

  it("em uso: padrão é ficar só com a categoria; escolher outra manda moverPara", async () => {
    renderizar("/subcategorias/racao/excluir")
    expect(await screen.findByText("Pets › Ração")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "O que está nela vai pra" })).toHaveTextContent("Sem subcategoria (fica só Pets)")
    await userEvent.click(screen.getByRole("combobox", { name: "O que está nela vai pra" }))
    await userEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Veterinário" }))
    await userEvent.click(screen.getByRole("button", { name: "Excluir subcategoria" }))
    expect(deleteSubcategory).toHaveBeenCalledWith("racao", "vet")
  })

  it("sem escolher: exclui deixando os lançamentos só na categoria", async () => {
    renderizar("/subcategorias/racao/excluir")
    await userEvent.click(await screen.findByRole("button", { name: "Excluir subcategoria" }))
    expect(deleteSubcategory).toHaveBeenCalledWith("racao", undefined)
  })
})
