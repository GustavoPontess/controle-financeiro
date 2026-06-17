export interface SenhaRequisito {
  label: string
  ok: boolean
}

export function getSenhaRequisitos(senha: string): SenhaRequisito[] {
  return [
    { label: 'Mínimo 15 caracteres', ok: senha.length >= 15 && senha.length <= 128 },
    { label: '1 letra minúscula', ok: /[a-z]/.test(senha) },
    { label: '1 letra maiúscula', ok: /[A-Z]/.test(senha) },
    { label: '1 número', ok: /[0-9]/.test(senha) },
    { label: '1 caractere especial (!@#$%^&*…)', ok: /[^a-zA-Z0-9]/.test(senha) },
  ]
}

export function getSenhaForca(requisitos: SenhaRequisito[]): number {
  return requisitos.filter((r) => r.ok).length
}
