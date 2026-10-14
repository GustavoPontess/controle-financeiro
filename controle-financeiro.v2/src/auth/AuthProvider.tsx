// Sessão do v2: a mesma da API (cookies). Ao abrir, pergunta /auth/me; login e sair pelos mesmos endpoints.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { api } from "../api/cliente"
import { AuthContext, type ResultadoEntrar, type Usuario } from "./contexto"

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [carregando, setCarregando] = useState(true)

  const recarregar = useCallback(async () => {
    try {
      const r = await api.get("/auth/me", { skipErrorToast: true })
      const d = r.data as Usuario | { usuario?: Usuario }
      setUsuario(("usuario" in d && d.usuario) ? d.usuario : (d as Usuario))
    } catch {
      setUsuario(null)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { void recarregar() }, [recarregar])

  const entrar = useCallback(async (email: string, senha: string, manterConectado: boolean): Promise<ResultadoEntrar> => {
    const r = await api.post("/auth/login", { email, password: senha, manterConectado }, { skipErrorToast: true })
    const d = r.data as { mfaRequerido?: boolean; contaMarcadaExclusao?: boolean } | undefined
    if (d?.mfaRequerido) return "mfa"
    if (d?.contaMarcadaExclusao) return "exclusao"
    await recarregar()
    return "ok"
  }, [recarregar])

  const sair = useCallback(async () => {
    try { await api.post("/auth/logout-all", undefined, { skipErrorToast: true }) } catch { /* sessão já morta */ }
    setUsuario(null)
  }, [])

  const valor = useMemo(() => ({ usuario, carregando, autenticado: usuario !== null, entrar, sair, recarregar }), [usuario, carregando, entrar, sair, recarregar])
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
