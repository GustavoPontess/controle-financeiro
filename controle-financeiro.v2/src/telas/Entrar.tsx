// Login do v2: mesma conta do app atual. Quem já entrou lá normalmente nem vê esta tela (cookie compartilhado).
import { useEffect, useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import Logo from "../componentes/Logo"
import { useAuth } from "../auth/useAuth"
import { useTema } from "../layout/useTema"
import { APP_ATUAL } from "../config"
import styles from "./Entrar.module.css"

export default function Entrar() {
  const { entrar, autenticado, carregando } = useAuth()
  const navigate = useNavigate()
  const [tema] = useTema()
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [manter, setManter] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => { if (!carregando && autenticado) navigate("/dashboard", { replace: true }) }, [autenticado, carregando, navigate])

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setErro(null); setAviso(null)
    if (!email.trim() || !senha) { setErro("Informe e-mail e senha."); return }
    setEnviando(true)
    try {
      const r = await entrar(email.trim(), senha, manter)
      if (r === "ok") navigate("/dashboard", { replace: true })
      else if (r === "mfa") setAviso("Esta conta usa verificação em duas etapas. Entre pelo app atual — a sessão vale aqui também.")
      else setAviso("Esta conta está em carência de exclusão. Reative pelo app atual.")
    } catch {
      setErro("E-mail ou senha incorretos.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className={`v2 ${styles.raiz}`} data-tema={tema}>
      <aside className={styles.palco}>
        <div className={styles.marca}><Logo size={28} /></div>
        <p className={styles.frase}>Suas finanças, com a calma de quem sabe onde o dinheiro está.</p>
      </aside>
      <main className={styles.painel}>
        <form className={styles.form} onSubmit={enviar} noValidate>
          <h1 className={styles.titulo}>Entrar</h1>
          <label className={styles.campo}>
            <span>E-mail</span>
            <input type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setErro(null) }} />
          </label>
          <label className={styles.campo}>
            <span>Senha</span>
            <input type="password" autoComplete="current-password" value={senha} onChange={(e) => { setSenha(e.target.value); setErro(null) }} />
          </label>
          <label className={styles.lembrar}>
            <input type="checkbox" checked={manter} onChange={(e) => setManter(e.target.checked)} /> Manter conectado
          </label>
          {erro && <p className={styles.erro} role="alert">{erro}</p>}
          {aviso && <p className={styles.aviso}>{aviso} <a href={`${APP_ATUAL}/auth/login`}>Abrir o app atual</a></p>}
          <button type="submit" className={styles.botao} disabled={enviando}>
            {enviando ? "Entrando…" : <>Entrar <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" /></>}
          </button>
        </form>
      </main>
    </div>
  )
}
