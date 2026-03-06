import { api } from "../api/axiosConfig"
import type { Category } from "../types/Category"

export const getCategories = async (): Promise<Category[]> => {
  const res = await api.get("/categorias")
  return res.data
}

export const createCategory = async (category: Omit<Category, "id">) => {
  const res = await api.post("/categorias", category)
  return res.data
}