import { api } from "../api/cliente"
import type { Subcategory } from "../types/Subcategory"
import type { UsoSubcategoria } from "../types/Category"

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

export const getSubcategory = async (id: string): Promise<Subcategory> => {
  const res = await api.get(`/subcategorias/${id}`)
  return res.data
}

export const getUsoSubcategoria = async (id: string): Promise<UsoSubcategoria> => {
  const res = await api.get(`/subcategorias/${id}/uso`)
  return res.data
}

/** Exclui. Com `moverPara` (da mesma categoria) os lançamentos vão pra ela; sem, ficam só com a categoria. */
export const deleteSubcategory = async (id: string, moverPara?: string): Promise<void> => {
  await api.delete(`/subcategorias/${id}`, { params: moverPara ? { moverPara } : undefined })
}
