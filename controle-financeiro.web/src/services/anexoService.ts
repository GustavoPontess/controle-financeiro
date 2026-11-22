import { api } from "../api/cliente"
import type { AnexoTransacao, Ponto } from "../types/Transaction"

// Anexos e localização de um lançamento (2026-11-07). Só o dono do lançamento; o servidor confere o arquivo pelo
// conteúdo, redesenha a foto (WebP, sem GPS/EXIF) e o PDF só sai como download.

export const listarAnexos = (transacaoId: string) =>
  api.get<AnexoTransacao[]>(`/transacoes/${transacaoId}/anexos`, { skipErrorToast: true }).then((r) => r.data)

export const enviarAnexo = (transacaoId: string, arquivo: File) => {
  const corpo = new FormData()
  corpo.append("arquivo", arquivo)
  return api.post<AnexoTransacao>(`/transacoes/${transacaoId}/anexos`, corpo, { skipErrorToast: true }).then((r) => r.data)
}

export const removerAnexo = (transacaoId: string, anexoId: string) =>
  api.delete(`/transacoes/${transacaoId}/anexos/${anexoId}`, { skipErrorToast: true }).then(() => undefined)

/** Endereço do arquivo (foto abre, PDF baixa). Mesma origem: o cookie da sessão vai junto. */
export const urlDoAnexo = (transacaoId: string, anexoId: string) => `/api/v1/transacoes/${transacaoId}/anexos/${anexoId}`

export const definirLocalizacao = (transacaoId: string, ponto: Ponto | null) =>
  (ponto
    ? api.put(`/transacoes/${transacaoId}/localizacao`, ponto, { skipErrorToast: true })
    : api.delete(`/transacoes/${transacaoId}/localizacao`, { skipErrorToast: true })).then(() => undefined)
