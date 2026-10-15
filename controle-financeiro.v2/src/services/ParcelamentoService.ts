import { api } from "../api/cliente"
import type {
  Parcelamento,
  ParcelamentoDetalhe,
  CriarParcelamentoPayload,
  CancelarParcelamentoPayload,
  CancelamentoResultado,
} from '../types/Parcelamento'
import type {
  PagarParcelaPayload,
  PagarParcelaResultado,
  CancelarParcelaPayload,
  CancelarParcelaResultado,
} from '../types/ParcelaTransacao'
import type { PagedResult } from '../types/Paged'

export const ParcelamentoService = {
  // ── Parcelamentos ──

  /** Lista paginada — backend clampa pageSize em 1..100. */
  async listarPaginado(
    page: number,
    pageSize: number,
    ativo?: boolean,
    /** Só os de um cartão (filtro no servidor — a página do cartão pagina só os dele). */
    cartaoCreditoId?: string,
  ): Promise<PagedResult<Parcelamento>> {
    const params: Record<string, unknown> = { page, pageSize }
    if (ativo !== undefined) params.ativo = ativo
    if (cartaoCreditoId) params.cartaoCreditoId = cartaoCreditoId
    const res = await api.get('/parcelamentos', { params })
    return res.data
  },

  /** KPIs agregados — ativos, soma do restante, total. */
  async obterStats(cartaoCreditoId?: string): Promise<{ ativos: number; totalRestante: number; qtdTotal: number }> {
    const res = await api.get('/parcelamentos/stats', { params: cartaoCreditoId ? { cartaoCreditoId } : undefined })
    return res.data
  },

  /** @deprecated Use listarPaginado. Clampa em 100. */
  async listar(ativo?: boolean): Promise<Parcelamento[]> {
    const params: Record<string, unknown> = { page: 1, pageSize: 100 }
    if (ativo !== undefined) params.ativo = ativo
    const res = await api.get('/parcelamentos', { params })
    return res.data.items
  },

  async obterDetalhe(id: string): Promise<ParcelamentoDetalhe> {
    const res = await api.get(`/parcelamentos/${id}`)
    return res.data
  },

  async criar(payload: CriarParcelamentoPayload): Promise<ParcelamentoDetalhe> {
    const res = await api.post('/parcelamentos', payload, {
      headers: {
        'Idempotency-Key': payload.idempotencyKey,
      },
    })
    return res.data
  },

  async cancelar(
    id: string,
    payload: CancelarParcelamentoPayload
  ): Promise<CancelamentoResultado> {
    const res = await api.post(`/parcelamentos/${id}/cancelar`, payload, {
      headers: {
        'Idempotency-Key': payload.idempotencyKey,
      },
    })
    return res.data
  },

  // ── Parcelas (antecipação e cancelamento individual) ──

  async pagarParcelaAntecipado(
    parcelaId: string,
    payload: PagarParcelaPayload
  ): Promise<PagarParcelaResultado> {
    const res = await api.post(`/parcelas/${parcelaId}/pagar`, payload, {
      headers: {
        'Idempotency-Key': payload.idempotencyKey,
      },
    })
    return res.data
  },

  async cancelarParcela(
    parcelaId: string,
    payload: CancelarParcelaPayload
  ): Promise<CancelarParcelaResultado> {
    const res = await api.post(`/parcelas/${parcelaId}/cancelar`, payload, {
      headers: {
        'Idempotency-Key': payload.idempotencyKey,
      },
    })
    return res.data
  },

  // ── Helpers ──

  gerarIdempotencyKey(): string {
    return crypto.randomUUID()
  },

  formatarMesAno(data: Date): string {
    const ano = data.getFullYear()
    const mes = String(data.getMonth() + 1).padStart(2, '0')
    return `${ano}-${mes}`
  },

  obterMesProximo(): string {
    const agora = new Date()
    agora.setMonth(agora.getMonth() + 1)
    return this.formatarMesAno(agora)
  },
}
