import { api } from "../api/cliente"
import type { Category, UsoCategoria } from "../types/Category"

export const getCategories = async (): Promise<Category[]> => {
  const res = await api.get("/categorias")
  return res.data
}

export const getCategory = async (id: string): Promise<Category> => {
  const res = await api.get(`/categorias/${id}`)
  return res.data
}

export const createCategory = async (category: Omit<Category, "id" | "isPadrao">): Promise<Category> => {
  const res = await api.post("/categorias", category)
  return res.data
}

/** Renomeia ou troca o tipo (só as do usuário; o tipo novo tem que aceitar o que já está nela). */
export const updateCategory = async (id: string, dto: Omit<Category, "id" | "isPadrao">): Promise<Category> => {
  const res = await api.put(`/categorias/${id}`, dto)
  return res.data
}

export const getUsoCategoria = async (id: string): Promise<UsoCategoria> => {
  const res = await api.get(`/categorias/${id}/uso`)
  return res.data
}

/** Exclui. Em uso, `moverPara` é obrigatório: tudo vai pra ela (o servidor responde 409 sem). */
export const deleteCategory = async (id: string, moverPara?: string): Promise<void> => {
  await api.delete(`/categorias/${id}`, { params: moverPara ? { moverPara } : undefined })
}
