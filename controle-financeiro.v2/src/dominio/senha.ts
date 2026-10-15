// Regra de senha — espelha PasswordPolicyService do servidor (NIST SP 800-63B §5.1.1.2): só o tamanho
// importa (15 a 128), sem exigir maiúscula/número/especial; a lista de senhas comuns fica no servidor.
export const SENHA_MIN = 15
export const SENHA_MAX = 128

export type RequisitoSenha = { rotulo: string; ok: boolean }

export const requisitosSenha = (senha: string): RequisitoSenha[] => [
  { rotulo: `Mínimo ${SENHA_MIN} caracteres`, ok: senha.length >= SENHA_MIN && senha.length <= SENHA_MAX },
]

export const senhaValida = (senha: string) => requisitosSenha(senha).every((r) => r.ok)
