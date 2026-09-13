export interface SenhaRequisito {
  label: string
  ok: boolean
}

// NIST SP 800-63B §5.1.1.2: só tamanho importa, SHALL NOT exigir composição
// (maiúscula/número/especial) — removido em 2026-08-23.
export function getSenhaRequisitos(senha: string): SenhaRequisito[] {
  return [
    { label: 'Mínimo 15 caracteres', ok: senha.length >= 15 && senha.length <= 128 },
  ]
}
