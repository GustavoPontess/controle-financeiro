// Convidar pra família (/familias/:id/convidar): e-mail de quem entra, a relação com a família (Cônjuge,
// Filho(a)… ou outra, digitada) e o que a pessoa pode fazer (lançar e dividir, ou só ver). Quem recebe aceita
// em Famílias, no app dela. Só admin chega aqui (o servidor confere de novo).
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { convidarMembro, getFamilia } from "../services/familiaService"
import { mensagemDeErro } from "../api/cliente"
import type { PapelFamilia } from "../types/Familia"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Entrada from "../componentes/Entrada"
import Formulario, { Campos, PaginaFormulario, RodapeFormulario } from "../componentes/Formulario"
import Segmentos from "../componentes/Segmentos"
import Selecao from "../componentes/Selecao"
import { MAX_PAPEL, PAPEIS_RELACAO, PAPEL_PERMISSAO } from "../dominio/familia"
import styles from "./Familia.module.css"

const OUTRO = "__outro"
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
type Erros = Partial<Record<"email" | "papel", string>>

export default function ConvidarMembro() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [nomeFamilia, setNomeFamilia] = useState<string | null>(null)
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [relacao, setRelacao] = useState<string>(PAPEIS_RELACAO[0])
  const [outra, setOutra] = useState("")
  const [permissao, setPermissao] = useState<string>(String(PAPEL_PERMISSAO.membro))
  const [erros, setErros] = useState<Erros>({})
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const voltar = () => navigate(`/familias/${id}`, { replace: true })

  useEffect(() => {
    let vivo = true
    getFamilia(id).then((f) => { if (vivo) setNomeFamilia(f.nome) }).catch(() => { if (vivo) setErroCarga("Não deu pra carregar a família. Recarregue a página.") })
    return () => { vivo = false }
  }, [id])

  const papel = relacao === OUTRO ? outra.trim() : relacao
  const enviar = async () => {
    setErro(null)
    const e: Erros = {}
    if (!email.trim()) e.email = "Digite o e-mail de quem você quer convidar."
    else if (!EMAIL.test(email.trim())) e.email = "Esse e-mail não parece certo."
    if (!papel) e.papel = "Diga qual é a relação dessa pessoa com a família."
    setErros(e)
    if (Object.keys(e).length > 0) return
    setSalvando(true)
    try {
      await convidarMembro(id, email.trim(), papel, Number(permissao) as PapelFamilia)
      voltar()
    } catch (err) {
      const msg = mensagemDeErro(err)
      if (/e-?mail/i.test(msg)) setErros({ email: msg }); else setErro(msg)
      setSalvando(false)
    }
  }

  return (
    <PaginaFormulario titulo={nomeFamilia ? `Convidar pra ${nomeFamilia}` : "Convidar"} carregando={nomeFamilia === null && !erroCarga} erroCarga={erroCarga}>
      <Formulario onSubmit={() => { void enviar() }}>
        <Campos>
          {erro && <p className={styles.alerta} role="alert">{erro}</p>}
          <Campo rotulo="E-mail" erro={erros.email}>
            <Entrada type="email" inputMode="email" autoComplete="off" value={email} maxLength={255} placeholder="nome@exemplo.com" autoFocus
              onChange={(e) => { setEmail(e.target.value); setErros((x) => ({ ...x, email: undefined })) }} />
          </Campo>
          <Campo rotulo="Relação com a família" erro={relacao !== OUTRO ? erros.papel : undefined}>
            <Selecao valor={relacao} onChange={(v) => { setRelacao(v); setErros((x) => ({ ...x, papel: undefined })) }}
              opcoes={[...PAPEIS_RELACAO.map((p) => ({ valor: p, rotulo: p })), { valor: OUTRO, rotulo: "Outra" }]} />
          </Campo>
          {relacao === OUTRO && (
            <Campo rotulo="Qual" erro={erros.papel}>
              <Entrada value={outra} maxLength={MAX_PAPEL} placeholder="Avó, enteado, colega de apê" autoFocus
                onChange={(e) => { setOutra(e.target.value); setErros((x) => ({ ...x, papel: undefined })) }} />
            </Campo>
          )}
          <Campo rotulo="O que a pessoa pode fazer" grupo>
            <Segmentos ariaLabel="O que a pessoa pode fazer" cheio valor={permissao} onChange={setPermissao}
              opcoes={[{ valor: String(PAPEL_PERMISSAO.membro), rotulo: "Lançar e dividir" }, { valor: String(PAPEL_PERMISSAO.dependente), rotulo: "Só ver" }]} />
          </Campo>
          <p className={styles.dica}>{permissao === String(PAPEL_PERMISSAO.dependente)
            ? "Vê as despesas e o balanço, mas não lança, não aprova nem acerta. Bom pra um filho com login."
            : "Lança despesas compartilhadas, divide, aprova e acerta. Não convida nem muda as regras (isso é de admin)."}</p>
        </Campos>
        <RodapeFormulario>
          <Botao onClick={voltar} disabled={salvando}>Cancelar</Botao>
          <Botao variante="primario" type="submit" disabled={salvando}>{salvando ? "Enviando…" : "Enviar convite"}</Botao>
        </RodapeFormulario>
      </Formulario>
    </PaginaFormulario>
  )
}
