import { api } from '@/api/axiosConfig'

export interface MfaStatus {
  ativo: boolean
  ativadoEm: string | null
  backupCodesRestantes: number
}

export interface MfaIniciarAtivacao {
  secretBase32: string
  qrCodeUri: string
}

const mfaService = {
  status: () => api.get<MfaStatus>('/auth/mfa/status').then((r) => r.data),

  iniciarAtivacao: () =>
    api.post<MfaIniciarAtivacao>('/auth/mfa/iniciar-ativacao').then((r) => r.data),

  confirmarAtivacao: (codigo: string) =>
    api.post<{ backupCodes: string[] }>('/auth/mfa/confirmar-ativacao', { codigo }).then((r) => r.data.backupCodes),

  desativar: (senhaAtual: string, codigo: string) =>
    api.post('/auth/mfa/desativar', { senhaAtual, codigo }),
}

export default mfaService
