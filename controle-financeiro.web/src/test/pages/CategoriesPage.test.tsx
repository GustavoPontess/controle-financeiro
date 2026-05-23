import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import CategoriesPage from "../../pages/Categories/CategoriesPage"
import type { Category } from "../../types/Category"
import type { Subcategory } from "../../types/Subcategory"

// Outlet context (notify + refresh) mockado
vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useOutletContext: () => ({ notify: vi.fn(), refreshTransactionRequirements: vi.fn() }),
}))

const getCategories = vi.fn()
const createCategory = vi.fn()
const deleteCategory = vi.fn()
vi.mock("../../services/categoryService", () => ({
  getCategories: (...a: unknown[]) => getCategories(...a),
  createCategory: (...a: unknown[]) => createCategory(...a),
  deleteCategory: (...a: unknown[]) => deleteCategory(...a),
}))

const getSubcategories = vi.fn()
const createSubcategory = vi.fn()
const updateSubcategory = vi.fn()
const deleteSubcategory = vi.fn()
vi.mock("../../services/subcategoryService", () => ({
  getSubcategories: (...a: unknown[]) => getSubcategories(...a),
  createSubcategory: (...a: unknown[]) => createSubcategory(...a),
  updateSubcategory: (...a: unknown[]) => updateSubcategory(...a),
  deleteSubcategory: (...a: unknown[]) => deleteSubcategory(...a),
}))

const cats: Category[] = [
  { id: "c1", descricao: "Mercado", finalidade: 1, isPadrao: false },
  { id: "c2", descricao: "Salário", finalidade: 2, isPadrao: true },
]
const subs: Subcategory[] = [
  { id: "s1", nome: "Hortifruti", cor: "#10B981", categoriaId: "c1", isPadrao: false },
]

function renderPage() {
  return render(<PontesThemeProvider><CategoriesPage /></PontesThemeProvider>)
}

describe("CategoriesPage (#83)", () => {
  beforeEach(() => {
    getCategories.mockReset().mockResolvedValue(cats)
    getSubcategories.mockReset().mockResolvedValue(subs)
  })

  it("lista categorias pessoais e padrão", async () => {
    renderPage()
    expect(await screen.findByText("Mercado")).toBeInTheDocument()
    expect(screen.getByText("Salário")).toBeInTheDocument()
    expect(screen.getByText("Minhas Categorias")).toBeInTheDocument()
    expect(screen.getByText("Categorias Padrão")).toBeInTheDocument()
  })

  it("expande a categoria e mostra a subcategoria", async () => {
    renderPage()
    const mercado = await screen.findByText("Mercado")
    // subcategoria escondida até expandir
    expect(screen.queryByText("Hortifruti")).not.toBeInTheDocument()
    fireEvent.click(mercado)
    await waitFor(() => expect(screen.getByText("Hortifruti")).toBeInTheDocument())
  })

  it("abre o modal de nova categoria", async () => {
    renderPage()
    await screen.findByText("Mercado")
    fireEvent.click(screen.getByText("Nova Categoria"))
    await waitFor(() => expect(screen.getByText("Nova categoria")).toBeInTheDocument())
  })

  it("criar categoria vazia mostra erro inline e não chama o service", async () => {
    renderPage()
    await screen.findByText("Mercado")
    fireEvent.click(screen.getByText("Nova Categoria"))
    await screen.findByText("Nova categoria")
    fireEvent.click(screen.getByRole("button", { name: "Criar" }))
    expect(createCategory).not.toHaveBeenCalled()
    expect(screen.getByText("Informe a descrição")).toBeInTheDocument()
  })
})
