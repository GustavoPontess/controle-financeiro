// Trocar a senha (Configurações → Segurança e login): senha atual + nova (regra NIST, mostrar/ocultar) +
// confirmação, e "Sair dos outros aparelhos" (marcado: quem troca por suspeita não deixa o intruso logado;
// este navegador continua). Trocar sempre esquece os dispositivos confiáveis (o servidor faz).
import { useState, type FormEvent } from "react"
import { Check, Eye, EyeOff } from "lucide-react"
import { api, mensagemDeErro } from "../api/cliente"
import Bloco from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Entrada from "../componentes/Entrada"
import { requisitosSenha, SENHA_MAX, senhaValida } from "../dominio/senha"
import styles from "./TrocarSenha.module.css"

type Erros = Partial<Record<"atual" | "nova" | "confirmar", string>>

export default function TrocarSenha({ aoTrocar }: {
  /** Depois de trocar (ex.: recarregar as sessões da página). */
  aoTrocar?: () => void
}) {
  const [aberto, setAberto] = useState(false)
  const [atual, setAtual] = useState("")
  const [nova, setNova] = useState("")
  const [confirmar, setConfirmar] = useState("")
  const [mostrar, setMostrar] = useState(false)
  const [sairDosOutros, setSairDosOutros] = useState(true)
  const [erros, setErros] = useState<Erros>({})
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const limpa = (k: keyof Erros) => setErros((e) => ({ ...e, [k]: undefined }))
  const fechar = () => { setAberto(false); setAtual(""); setNova(""); setConfirmar(""); setErros({}); setErro(null) }

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault()
    setErro(null)
    const e: Erros = {}
    if (!atual) e.atual = "Digite a senha atual."
    if (!nova) e.nova = "Crie a senha nova."
    else if (!senhaValida(nova)) e.nova = "A senha precisa ter pelo menos 15 caracteres."
    else if (nova === atual) e.nova = "Tem que ser diferente da atual."
    if (!confirmar) e.confirmar = "Repita a senha nova."
    else if (nova !== confirmar) e.confirmar = "As senhas não conferem."
    setErros(e)
    if (Object.keys(e).length > 0) return
    setEnviando(true)
    try {
      await api.post("/auth/change-password", { senhaAtual: atual, novaSenha: nova, encerrarOutrasSessoes: sairDosOutros }, { skipErrorToast: true })
      fechar()
      setOk(sairDosOutros ? "Senha trocada. Os outros aparelhos foram desconectados." : "Senha trocada.")
      aoTrocar?.()
    } catch (err) {
      const msg = mensagemDeErro(err)
      if (/senha atual/i.test(msg)) setErros({ atual: "Senha atual errada." })
      else setErro(msg)
    } finally {
      setEnviando(false)
    }
  }

  const olho = <Botao variante="texto" soIcone tabIndex={-1} aria-label={mostrar ? "Ocultar senhas" : "Mostrar senhas"} onClick={() => setMostrar((v) => !v)}
    icone={mostrar ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />} />

  return (
    <Bloco titulo="Senha">
      {ok && !aberto && <p className={styles.ok} role="status"><Check size={15} strokeWidth={2.5} aria-hidden="true" /> {ok}</p>}
      {!aberto ? (
        <div className={styles.linha}>
          <p className={styles.texto}>Use pelo menos 15 caracteres. Não precisa de número nem símbolo: uma frase comprida já é uma senha forte.</p>
          <Botao onClick={() => { setOk(null); setAberto(true) }}>Trocar senha</Botao>
        </div>
      ) : (
        <form className={styles.form} noValidate onSubmit={(e) => { void enviar(e) }}>
          {erro && <p className={styles.alerta} role="alert">{erro}</p>}
          <Campo rotulo="Senha atual" erro={erros.atual}>
            <Entrada type={mostrar ? "text" : "password"} autoComplete="current-password" maxLength={SENHA_MAX} value={atual} autoFocus
              onChange={(e) => { setAtual(e.target.value); limpa("atual") }} sufixo={olho} />
          </Campo>
          <Campo rotulo="Senha nova" erro={erros.nova}>
            <Entrada type={mostrar ? "text" : "password"} autoComplete="new-password" maxLength={SENHA_MAX} value={nova}
              onChange={(e) => { setNova(e.target.value); limpa("nova") }} />
          </Campo>
          {!erros.nova && (
            <ul className={styles.requisitos} aria-label="Requisitos da senha">
              {requisitosSenha(nova).map((r) => (
                <li key={r.rotulo} data-ok={r.ok || undefined}><Check size={14} strokeWidth={3} aria-hidden="true" />{r.rotulo}</li>
              ))}
            </ul>
          )}
          <Campo rotulo="Confirmar senha nova" erro={erros.confirmar}>
            <Entrada type={mostrar ? "text" : "password"} autoComplete="new-password" maxLength={SENHA_MAX} value={confirmar}
              onChange={(e) => { setConfirmar(e.target.value); limpa("confirmar") }} />
          </Campo>
          <label className={styles.marcar}>
            <input type="checkbox" checked={sairDosOutros} onChange={(e) => setSairDosOutros(e.target.checked)} /> Sair dos outros aparelhos
          </label>
          <div className={styles.acoes}>
            <Botao onClick={fechar} disabled={enviando}>Cancelar</Botao>
            <Botao variante="primario" type="submit" disabled={enviando}>{enviando ? "Salvando…" : "Trocar senha"}</Botao>
          </div>
        </form>
      )}
    </Bloco>
  )
}
