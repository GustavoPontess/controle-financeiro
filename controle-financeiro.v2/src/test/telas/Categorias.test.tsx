import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"

const CATEGORIAS = [
  { id: "c1", descricao: "Moradia", finalidade: 1, isPadrao: true },
  { id: "c2", descricao: "Pets", finalidade: 1, isPadrao: false },
  { id: "c3", descricao: "Salário", finalidade: 2, isPadrao: true },
  { id: "c4", descricao: "Reembolsos", finalidade: 3, isPadrao: false },
]
const SUBS = [
  { id: "s1", nome: "Aluguel", categoriaId: "c1", isPadrao: true },
  { id: "s2", nome: "Jardinagem", categoriaId: "c1", isPadrao: false },
  { id: "s3", nome: "Ração", categoriaId: "c2", isPadrao: false },
]
vi.mock("../../services/categoryService", () => ({ getCategories: vi.fn(async () => CATEGORIAS) }))
vi.mock("../../services/subcategoryService", () => ({ getSubcategories: vi.fn(async () => SUBS) }))
import Categorias from "../../telas/Categorias"

const Rota = ({ nome }: { nome: string }) => <p>{nome}</p>
const renderizar = (state?: unknown) => render(
  <MemoryRouter initialEntries={[{ pathname: "/categorias", state }]}>
    <Routes>
      <Route path="/categorias" element={<Categorias />} />
      <Route path="/categorias/nova" element={<Rota nome="nova categoria" />} />
      <Route path="/categorias/:id/editar" element={<Rota nome="editar categoria" />} />
      <Route path="/categorias/:id/excluir" element={<Rota nome="excluir categoria" />} />
      <Route path="/categorias/:id/subcategorias/nova" element={<Rota nome="nova subcategoria" />} />
      <Route path="/subcategorias/:id/editar" element={<Rota nome="editar subcategoria" />} />
      <Route path="/subcategorias/:id/excluir" element={<Rota nome="excluir subcategoria" />} />
    </Routes>
  </MemoryRouter>,
)
const lista = () => screen.getByRole("list", { name: "Categorias" })
const linha = (nome: RegExp) => within(lista()).getByRole("button", { name: nome })

describe("Categorias", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("Despesas: as da pessoa primeiro, depois as padrão; 'as duas' aparece nas duas abas", async () => {
    renderizar()
    await screen.findByRole("list", { name: "Categorias" })
    expect(within(screen.getByRole("list", { name: "Criadas por você" })).getAllByRole("button").map((b) => b.textContent))
      .toEqual([expect.stringContaining("Pets"), expect.stringContaining("Reembolsos")])
    expect(within(screen.getByRole("list", { name: "Padrão" })).getAllByRole("button")).toHaveLength(1)
    expect(linha(/Moradia/)).toHaveTextContent("Aluguel, Jardinagem")
    expect(screen.queryByText("Salário")).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("radio", { name: "Receitas" }))
    expect(linha(/Salário/)).toBeInTheDocument()
    expect(linha(/Reembolsos/)).toHaveTextContent("Despesa e receita")
    expect(within(lista()).queryByRole("button", { name: /Pets/ })).not.toBeInTheDocument()
  })

  it("padrão: ficha com subcategorias, só as da pessoa têm Editar/Excluir, e sem Editar/Excluir da categoria", async () => {
    renderizar()
    await userEvent.click(await screen.findByRole("button", { name: /Moradia/ }))
    const subs = screen.getByRole("list", { name: "Subcategorias de Moradia" })
    expect(within(subs).queryByRole("button", { name: "Editar Aluguel" })).not.toBeInTheDocument()
    expect(within(subs).getByRole("button", { name: "Editar Jardinagem" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Nova subcategoria" }))
    expect(await screen.findByText("nova subcategoria")).toBeInTheDocument()
  })

  it("da pessoa: Editar e Excluir levam às páginas", async () => {
    renderizar()
    await userEvent.click(await screen.findByRole("button", { name: /Pets/ }))
    await userEvent.click(screen.getByRole("button", { name: "Excluir" }))
    expect(await screen.findByText("excluir categoria")).toBeInTheDocument()
  })

  it("chega com state.abrir e state.tipo: abre a categoria na aba dela", async () => {
    renderizar({ abrir: "c3", tipo: 2 })
    expect(await screen.findByRole("radio", { name: "Receitas", checked: true })).toBeInTheDocument()
    expect(linha(/Salário/)).toHaveAttribute("aria-expanded", "true")
  })
})
