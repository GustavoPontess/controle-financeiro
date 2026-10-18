// Perfil (Configurações → Perfil): nome e data de nascimento editáveis na própria caixa; e-mail só leitura
// (trocar e-mail não existe ainda). Salvar recarrega /auth/me, então o nome no menu muda na hora.
import { useState, type FormEvent } from "react"
import { Check } from "lucide-react"
import { useAuth } from "../auth/useAuth"
import { mensagemDeErro } from "../api/cliente"
import contaService from "../services/minhaContaService"
import Bloco from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Entrada from "../componentes/Entrada"
import { LinhaCampos } from "../componentes/Formulario"
import { dataBR } from "../utils/dateTime"
import styles from "./Perfil.module.css"

export const NOME_MAX = 200
type Erros = Partial<Record<"nome" | "nascimento", string>>

export default function Perfil() {
  const { usuario, recarregar } = useAuth()
  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState("")
  const [nascimento, setNascimento] = useState("")
  const [erros, setErros] = useState<Erros>({})
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const hoje = new Date().toISOString().slice(0, 10)
  const nascimentoAtual = usuario?.dataNascimento ? usuario.dataNascimento.slice(0, 10) : ""

  const abrir = () => { setNome(usuario?.nome ?? ""); setNascimento(nascimentoAtual); setErros({}); setErro(null); setOk(null); setEditando(true) }
  const fechar = () => { setEditando(false); setErros({}); setErro(null) }
  const limpa = (k: keyof Erros) => setErros((e) => ({ ...e, [k]: undefined }))

  const salvar = async (ev: FormEvent) => {
    ev.preventDefault()
    const e: Erros = {}
    if (!nome.trim()) e.nome = "Diga como quer ser chamado."
    if (nascimento && nascimento > hoje) e.nascimento = "Não pode ser no futuro."
    setErros(e)
    if (Object.keys(e).length > 0) return
    setSalvando(true); setErro(null)
    try {
      await contaService.atualizarPerfil(nome.trim(), nascimento || null)
      await recarregar()
      setEditando(false)
      setOk("Dados salvos.")
    } catch (err) { setErro(mensagemDeErro(err)) }
    setSalvando(false)
  }

  return (
    <Bloco titulo="Seus dados" acao={editando ? undefined : "Editar"} aoClicar={abrir}>
      {ok && !editando && <p className={styles.ok} role="status"><Check size={15} strokeWidth={2.5} aria-hidden="true" /> {ok}</p>}
      {!editando ? (
        <dl className={styles.dados}>
          <div><dt>Nome</dt><dd>{usuario?.nome ?? "…"}</dd></div>
          <div><dt>E-mail</dt><dd>{usuario?.email ?? "…"}</dd></div>
          <div><dt>Data de nascimento</dt><dd>{nascimentoAtual ? dataBR(nascimentoAtual) : <span className={styles.vazio}>Não informada</span>}</dd></div>
        </dl>
      ) : (
        <form className={styles.form} noValidate onSubmit={(e) => { void salvar(e) }}>
          {erro && <p className={styles.alerta} role="alert">{erro}</p>}
          <LinhaCampos colunas="minmax(0, 2fr) minmax(0, 1fr)">
            <Campo rotulo="Nome" erro={erros.nome}>
              <Entrada value={nome} maxLength={NOME_MAX} autoComplete="name" autoFocus onChange={(e) => { setNome(e.target.value); limpa("nome") }} />
            </Campo>
            <Campo rotulo="Data de nascimento" erro={erros.nascimento}>
              <Entrada type="date" autoComplete="bday" max={hoje} value={nascimento} onChange={(e) => { setNascimento(e.target.value); limpa("nascimento") }} />
            </Campo>
          </LinhaCampos>
          <div className={styles.email}><span>E-mail</span><span>{usuario?.email}</span></div>
          <div className={styles.acoes}>
            <Botao onClick={fechar} disabled={salvando}>Cancelar</Botao>
            <Botao variante="primario" type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Botao>
          </div>
        </form>
      )}
    </Bloco>
  )
}
