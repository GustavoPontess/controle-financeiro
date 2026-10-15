// Sessão do v2: a mesma da API (cookies). Ao abrir, pergunta /auth/me; login (com MFA e carência de
// exclusão), reativar e sair pelos mesmos endpoints do app atual.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { api, mensagemDeErro } from "../api/cliente"
import { AuthContext, type ResultadoEntrar, type Usuario } from "./contexto"

const SEM_TOAST = { skipErrorToast: true } as const

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [carregando, setCarregando] = useState(true)

  const recarregar = useCallback(async () => {
    try {
      const r = await api.get<Usuario>("/auth/me", SEM_TOAST)
      setUsuario(r.data)
    } catch {
      setUsuario(null)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { void recarregar() }, [recarregar])

  const entrar = useCallback(async (email: string, senha: string, manterConectado: boolean): Promise<ResultadoEntrar> => {
    let d: { mfaRequerido?: boolean; mfaChallengeToken?: string; contaMarcadaExclusao?: boolean; diasRestantes?: number | null }
    try {
      d = (await api.post("/auth/login", { email, password: senha, manterConectado }, SEM_TOAST)).data ?? {}
    } catch (e) {
      throw new Error(mensagemDeErro(e))
    }
    if (d.mfaRequerido && d.mfaChallengeToken) return { tipo: "mfa", challengeToken: d.mfaChallengeToken }
    if (d.contaMarcadaExclusao) return { tipo: "exclusao", diasRestantes: d.diasRestantes ?? null }
    await recarregar()
    return { tipo: "ok" }
  }, [recarregar])

  const verificarMfa = useCallback(async (challengeToken: string, codigo: string, confiarDispositivo: boolean, manterConectado: boolean) => {
    try {
      await api.post("/auth/mfa/verificar-login", { challengeToken, codigo, confiarDispositivo, manterConectado }, SEM_TOAST)
    } catch (e) {
      throw new Error(mensagemDeErro(e))
    }
    await recarregar()
  }, [recarregar])

  const reativar = useCallback(async (email: string, senha: string) => {
    try {
      await api.post("/auth/conta/reativar", { email, senha }, SEM_TOAST)
    } catch (e) {
      throw new Error(mensagemDeErro(e))
    }
  }, [])

  const sair = useCallback(async () => {
    try { await api.post("/auth/logout-all", undefined, SEM_TOAST) } catch { /* sessão já morta */ }
    setUsuario(null)
  }, [])

  const valor = useMemo(
    () => ({ usuario, carregando, autenticado: usuario !== null, entrar, verificarMfa, reativar, sair, recarregar }),
    [usuario, carregando, entrar, verificarMfa, reativar, sair, recarregar],
  )
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
