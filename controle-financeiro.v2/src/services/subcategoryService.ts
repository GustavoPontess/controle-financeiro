import { api } from "../api/cliente"
import type { Subcategory } from "../types/Subcategory"

/** Lista subcategorias do usuário (+ padrões). Filtra por categoria quando informado. */
export const getSubcategories = async (categoriaId?: string): Promise<Subcategory[]> => {
  const res = await api.get("/subcategorias", {
    params: categoriaId ? { categoriaId } : undefined,
  })
  return res.data
}

export const createSubcategory = async (
  dto: { nome: string; icone?: string | null; cor?: string | null; categoriaId: string }
): Promise<Subcategory> => {
  const res = await api.post("/subcategorias", dto)
  return res.data
}

export const updateSubcategory = async (
  id: string,
  dto: { nome: string; icone?: string | null; cor?: string | null }
): Promise<Subcategory> => {
  const res = await api.put(`/subcategorias/${id}`, dto)
  return res.data
}

export const deleteSubcategory = async (id: string): Promise<void> => {
  await api.delete(`/subcategorias/${id}`)
}
