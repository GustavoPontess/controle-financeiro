// Regra de senha. Espelha o PasswordPolicyService do servidor (NIST SP 800-63B rev4 §3.1.1.2): só o tamanho
// importa (15 a 128 caracteres de verdade: emoji conta 1, acento decomposto conta 1), sem exigir maiúscula,
// número ou símbolo. Senha comum, previsível, igual ao e-mail ou já vazada o servidor recusa e diz o motivo.
export const SENHA_MIN = 15
export const SENHA_MAX = 128

export type RequisitoSenha = { rotulo: string; ok: boolean }

/** Tamanho como o servidor conta: code points depois do NFC. */
export const tamanhoSenha = (senha: string) => Array.from(senha.normalize("NFC")).length

export const requisitosSenha = (senha: string): RequisitoSenha[] => {
  const n = tamanhoSenha(senha)
  return [{ rotulo: `Mínimo ${SENHA_MIN} caracteres`, ok: n >= SENHA_MIN && n <= SENHA_MAX }]
}

/** Recusa do servidor que é sobre a senha em si (comum, vazada, e-mail, requisito): vai pro campo, não pro topo. */
export const ehErroDaSenha = (mensagem: string) => /vazou|muito comum|e-mail como senha|requisitos|caracteres/i.test(mensagem)

export const senhaValida = (senha: string) => requisitosSenha(senha).every((r) => r.ok)
