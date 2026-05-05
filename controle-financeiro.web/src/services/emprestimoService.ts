import { api } from "../api/axiosConfig"
import type { Emprestimo, CriarEmprestimo } from "../types/Emprestimo"

export const getEmprestimos = async (): Promise<Emprestimo[]> => {
  const res = await api.get("/emprestimos")
  return res.data
}

export const createEmprestimo = async (dto: CriarEmprestimo): Promise<Emprestimo> => {
  const res = await api.post("/emprestimos", dto)
  return res.data
}

export const registrarPagamento = async (id: string, valor: number): Promise<void> => {
  await api.patch(`/emprestimos/${id}/pagamento`, { valor })
}

export const quitarEmprestimo = async (id: string): Promise<void> => {
  await api.patch(`/emprestimos/${id}/quitar`)
}

export const deleteEmprestimo = async (id: string): Promise<void> => {
  await api.delete(`/emprestimos/${id}`)
}
