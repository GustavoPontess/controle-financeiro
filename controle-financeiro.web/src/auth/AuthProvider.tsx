// Sessão do v2: a mesma da API (cookies). Ao abrir, pergunta /auth/me; login (com MFA e carência de
// exclusão), reativar e sair pelos mesmos endpoints do app atual.
// Multi-conta: a API parqueia um cookie `rt_<conta>` por conta conectada e troca a ativa em /auth/switch;
// como o cookie é httpOnly, a LISTA (nome, e-mail) mora no navegador. Login frio começa a lista do zero
// (o servidor já revogou as contas de quem usou o navegador antes); "Sair" sai de todas.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { api, definirContaDaAba, mensagemDeErro } from "../api/cliente"
import { AuthContext, type ContaConectada, type ResultadoEntrar, type Usuario } from "./contexto"

const SEM_TOAST = { skipErrorToast: true } as const
const CHAVE_CONTAS = "v2:contas"
const lerContas = (): ContaConectada[] => {
  try { const v: unknown = JSON.parse(localStorage.getItem(CHAVE_CONTAS) ?? "[]"); return Array.isArray(v) ? (v as ContaConectada[]) : [] } catch { return [] }
}
const gravarContas = (c: ContaConectada[]) => { try { localStorage.setItem(CHAVE_CONTAS, JSON.stringify(c)) } catch { /* sem armazenamento */ } }
const comConta = (lista: ContaConectada[], u: Usuario): ContaConectada[] => [...lista.filter((c) => c.id !== u.id), { id: u.id, nome: u.nome, email: u.email }]

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [contas, setContas] = useState<ContaConectada[]>(lerContas)
  const guardar = useCallback((lista: ContaConectada[]) => { setContas(lista); gravarContas(lista) }, [])

  const recarregar = useCallback(async () => {
    try {
      const r = await api.get<Usuario>("/auth/me", SEM_TOAST)
      definirContaDaAba(r.data.id)
      setUsuario(r.data)
      setContas((prev) => { const lista = comConta(prev, r.data); gravarContas(lista); return lista })
    } catch {
      definirContaDaAba(null)
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
    guardar([]) // login frio: a lista começa só com esta conta
    await recarregar()
    return { tipo: "ok" }
  }, [recarregar, guardar])

  const verificarMfa = useCallback(async (challengeToken: string, codigo: string, confiarDispositivo: boolean, manterConectado: boolean) => {
    try {
      await api.post("/auth/mfa/verificar-login", { challengeToken, codigo, confiarDispositivo, manterConectado }, SEM_TOAST)
    } catch (e) {
      throw new Error(mensagemDeErro(e))
    }
    guardar([])
    await recarregar()
  }, [recarregar, guardar])

  const reativar = useCallback(async (email: string, senha: string) => {
    try {
      await api.post("/auth/conta/reativar", { email, senha }, SEM_TOAST)
    } catch (e) {
      throw new Error(mensagemDeErro(e))
    }
  }, [])

  const sair = useCallback(async () => {
    try { await api.post("/auth/logout-all", undefined, SEM_TOAST) } catch { /* sessão já morta */ }
    guardar([])
    definirContaDaAba(null)
    setUsuario(null)
  }, [guardar])

  const adicionarConta = useCallback(async (email: string, senha: string) => {
    let d: { contaMarcadaExclusao?: boolean }
    try {
      d = (await api.post("/auth/add-account", { email, password: senha }, SEM_TOAST)).data ?? {}
    } catch (e) {
      throw new Error(mensagemDeErro(e))
    }
    if (d.contaMarcadaExclusao) throw new Error("Essa conta está marcada pra exclusão. Entre por ela na tela de login pra reativar.")
    await recarregar()
  }, [recarregar])

  const trocarConta = useCallback(async (id: string) => {
    if (id === usuario?.id) return
    try {
      await api.post("/auth/switch", { accountId: id }, SEM_TOAST)
    } catch {
      guardar(contas.filter((c) => c.id !== id))
      throw new Error("A sessão dessa conta acabou. Entre nela de novo.")
    }
    await recarregar()
  }, [usuario?.id, contas, guardar, recarregar])

  const valor = useMemo(
    () => ({ usuario, carregando, autenticado: usuario !== null, contas, entrar, verificarMfa, reativar, sair, recarregar, adicionarConta, trocarConta }),
    [usuario, carregando, contas, entrar, verificarMfa, reativar, sair, recarregar, adicionarConta, trocarConta],
  )
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
