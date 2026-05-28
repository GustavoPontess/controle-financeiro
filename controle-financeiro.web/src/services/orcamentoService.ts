import { api } from "../api/axiosConfig"
import type { Orcamento, CriarOrcamentoDto } from "../types/Orcamento"

const BASE = "orcamentos"

export const getOrcamentos = (mes?: number, ano?: number): Promise<{ data: Orcamento[] }> =>
  api.get(BASE, { params: { ...(mes !== undefined && { mes }), ...(ano !== undefined && { ano }) } })

export const criarOrcamento = (dto: CriarOrcamentoDto): Promise<{ data: Orcamento }> =>
  api.post(BASE, dto)

export const atualizarOrcamento = (id: string, dto: CriarOrcamentoDto): Promise<{ data: Orcamento }> =>
  api.put(`${BASE}/${id}`, dto)

export const excluirOrcamento = (id: string): Promise<void> =>
  api.delete(`${BASE}/${id}`)
