// Convidar pra acompanhar junto (/emprestimos/:id/convidar): o e-mail da pessoa; ela vê o convite em "Pra responder"
// (se tiver conta) e o link volta pra mandar por fora (o app não manda e-mail sozinho). Aceitando, os dois veem o
// mesmo empréstimo e quem pegou registra o que devolveu pro outro confirmar. A resposta é sempre igual, exista ou
// não a conta (anti-enumeração).
import { useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { vincularEmprestimo } from "../services/emprestimoService"
import { mensagemDeErro } from "../api/cliente"
import type { Emprestimo } from "../types/Emprestimo"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Entrada from "../componentes/Entrada"
import Formulario, { Campos, PaginaFormulario, RodapeFormulario } from "../componentes/Formulario"
import { quemDoOutroLado } from "../dominio/emprestimo"
import styles from "./EmprestimoFormulario.module.css"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_EMAIL = 254

export default function ConvidarEmprestimo() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const st = useLocation().state as { voltarPara?: string; emprestimo?: Emprestimo } | null
  const voltarPara = st?.voltarPara ?? "/emprestimos"
  const quem = st?.emprestimo ? quemDoOutroLado(st.emprestimo) : "a pessoa"
  const [email, setEmail] = useState("")
  const [erroEmail, setErroEmail] = useState<string | undefined>()
  const [erro, setErro] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const enviar = async () => {
    setErro(null)
    const t = email.trim()
    if (!EMAIL.test(t)) { setErroEmail("Diga um e-mail válido."); return }
    setEnviando(true)
    try {
      const r = await vincularEmprestimo(id, t)
      setLink(r.linkConvite)
    } catch (err) { setErro(mensagemDeErro(err)) }
    setEnviando(false)
  }
  const copiar = async () => {
    try { await navigator.clipboard.writeText(link!); setCopiado(true) } catch { /* sem área de transferência: o link está na tela */ }
  }

  return (
    <PaginaFormulario titulo={`Convidar ${quem.split(" ")[0]} pra acompanhar junto`}>
      <Formulario onSubmit={() => { void enviar() }}>
        <Campos>
          {erro && <p className={styles.alerta} role="alert">{erro}</p>}
          {link ? (
            <>
              <p className={styles.ok}>Convite criado. Se {quem.split(" ")[0]} tiver conta no Pontes Finanças, já aparece pra responder.</p>
              <Campo rotulo="Link pra mandar">
                <div className={styles.link}>
                  <Entrada readOnly value={link} onFocus={(x) => x.target.select()} />
                  <Botao onClick={() => { void copiar() }}>{copiado ? "Copiado" : "Copiar"}</Botao>
                </div>
              </Campo>
            </>
          ) : (
            <Campo rotulo={`E-mail de ${quem.split(" ")[0]}`} erro={erroEmail}>
              <Entrada type="email" autoFocus value={email} maxLength={MAX_EMAIL} placeholder="nome@email.com"
                onChange={(x) => { setEmail(x.target.value); setErroEmail(undefined) }} />
            </Campo>
          )}
        </Campos>
        <RodapeFormulario>
          {link ? (
            <Botao variante="primario" onClick={() => navigate(voltarPara, { replace: true, state: { abrir: id } })}>Pronto</Botao>
          ) : (
            <>
              <Botao onClick={() => navigate(voltarPara, { replace: true, state: { abrir: id } })} disabled={enviando}>Cancelar</Botao>
              <Botao variante="primario" type="submit" disabled={enviando}>{enviando ? "Criando…" : "Criar convite"}</Botao>
            </>
          )}
        </RodapeFormulario>
      </Formulario>
    </PaginaFormulario>
  )
}
