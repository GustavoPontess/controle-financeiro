import { api } from "../api/cliente"
import type { Meta, CriarMetaDto, ContribuirMetaDto } from "../types/Meta"

// axiosClient já provê baseURL `/api/v1` — path relativo evita duplicar `/api`.
const BASE = "metas"

export const getMetas = (): Promise<{ data: Meta[] }> =>
  api.get(BASE)

export const getMeta = (id: string): Promise<{ data: Meta }> =>
  api.get(`${BASE}/${id}`)

export const criarMeta = (dto: CriarMetaDto): Promise<{ data: Meta }> =>
  api.post(BASE, dto)

export const atualizarMeta = (id: string, dto: CriarMetaDto): Promise<{ data: Meta }> =>
  api.put(`${BASE}/${id}`, dto)

export const contribuirMeta = (id: string, dto: ContribuirMetaDto): Promise<{ data: Meta }> =>
  api.post(`${BASE}/${id}/contribuir`, dto)

export const excluirMeta = (id: string): Promise<void> =>
  api.delete(`${BASE}/${id}`)
