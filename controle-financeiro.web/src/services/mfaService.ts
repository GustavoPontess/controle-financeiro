import { api } from "../api/cliente"

export interface MfaStatus {
  ativo: boolean
  ativadoEm: string | null
  backupCodesRestantes: number
  /** Mostrar o convite "Proteja sua conta" depois do login (MFA desligado, não dispensado, fora do "agora não"). */
  mostrarConvite: boolean
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

  /** Resposta ao convite: nuncaMais = não perguntar mais; senão adia 30 dias. */
  responderConvite: (nuncaMais: boolean) =>
    api.post('/auth/mfa/convite', { nuncaMais }, { skipErrorToast: true }),
}

export default mfaService
