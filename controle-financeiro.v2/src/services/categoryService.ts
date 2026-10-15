import { api } from "../api/cliente"
import type { Category } from "../types/Category"

export const getCategories = async (): Promise<Category[]> => {
  const res = await api.get("/categorias")
  return res.data
}

export const createCategory = async (category: Omit<Category, "id" | "isPadrao">) => {
  const res = await api.post("/categorias", category)
  return res.data
}

export const deleteCategory = async (id: string): Promise<void> => {
  await api.delete(`/categorias/${id}`)
}