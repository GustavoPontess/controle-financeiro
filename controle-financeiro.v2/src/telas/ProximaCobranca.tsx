// Alterar só a próxima cobrança de uma conta fixa (/contas-fixas/:id/proxima): valor e descrição dessa
// ocorrência, sem mexer na regra nem nas seguintes (ex.: a conta de luz veio diferente este mês).
import { useEffect, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { editarProximaOcorrencia, getRecorrente } from "../services/recorrenteService"
import { mensagemDeErro } from "../api/cliente"
import type { Recorrente } from "../types/Recorrente"
import Bloco from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import { Dinheiro } from "../componentes/Dinheiro"
import Entrada from "../componentes/Entrada"
import EntradaValor from "../componentes/EntradaValor"
import Formulario, { Campos, Lado, PaginaFormulario, RodapeFormulario } from "../componentes/Formulario"
import { MAX_DESCRICAO, TIPO } from "../dominio/transacao"
import { formatMoney, moneyParaCampo, parseMoney } from "../utils/money"
import { dataBR } from "../utils/dateTime"
import styles from "./PagarFatura.module.css"

export default function ProximaCobranca() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const voltarPara = (location.state as { voltarPara?: string } | null)?.voltarPara ?? `/contas-fixas/${id}`
  const [r, setR] = useState<Recorrente | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    getRecorrente(id)
      .then((rec) => {
        if (!vivo) return
        if (!rec.proximaCobranca) { setErroCarga("Esta conta fixa não tem próxima cobrança."); return }
        setR(rec)
      })
      .catch(() => { if (vivo) setErroCarga("Não foi possível carregar a conta fixa. Recarregue a página.") })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [id])

  return (
    <PaginaFormulario titulo="Alterar a próxima cobrança" carregando={carregando} erroCarga={erroCarga}>
      {r && <FormularioProxima r={r} aoSair={() => navigate(voltarPara, { replace: true })} aoSalvo={() => navigate(voltarPara, { replace: true })} />}
    </PaginaFormulario>
  )
}

type Erros = Partial<Record<"valor" | "descricao", string>>

function FormularioProxima({ r, aoSair, aoSalvo }: { r: Recorrente; aoSair: () => void; aoSalvo: () => void }) {
  const [valor, setValor] = useState(moneyParaCampo(r.valor))
  const [descricao, setDescricao] = useState(r.descricao)
  const [erros, setErros] = useState<Erros>({})
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const limpa = (...chaves: (keyof Erros)[]) => setErros((e) => { const n = { ...e }; for (const k of chaves) delete n[k]; return n })
  const v = parseMoney(valor)
  const receita = r.tipo === TIPO.receita
  const mudou = v !== r.valor || descricao.trim() !== r.descricao

  const enviar = async () => {
    const e: Erros = {}
    if (!(v > 0)) e.valor = "Informe um valor."
    if (!descricao.trim()) e.descricao = "Informe a descrição."
    setErros(e)
    if (Object.keys(e).length > 0) return
    setSalvando(true); setErro(null)
    try {
      await editarProximaOcorrencia(r.id, { valor: v, descricao: descricao.trim() })
      aoSalvo()
    } catch (err) {
      setErro(mensagemDeErro(err)); setSalvando(false)
    }
  }

  return (
    <Formulario layout="lateral" onSubmit={() => { void enviar() }}>
      <Campos>
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}
        <Campo rotulo="Valor desta cobrança" erro={erros.valor}>
          <EntradaValor valor={valor} tom={receita ? "positivo" : "negativo"} autoFocus onChange={(x) => { setValor(x); limpa("valor") }} />
        </Campo>
        <Campo rotulo="Descrição desta cobrança" erro={erros.descricao}>
          <Entrada value={descricao} maxLength={MAX_DESCRICAO} onChange={(e) => { setDescricao(e.target.value); limpa("descricao") }} />
        </Campo>
      </Campos>
      <Lado>
        <Bloco titulo="Como vai ficar" className={styles.previa}>
          <span className={styles.previaTitulo}>{r.descricao}</span>
          <span className={styles.muted}>próxima cobrança em {r.proximaCobranca ? dataBR(r.proximaCobranca) : "—"}</span>
          <dl className={styles.contas}>
            <div><dt>Esta cobrança</dt><dd><Dinheiro valor={v > 0 ? v : 0} tom={receita ? "positivo" : "negativo"} /></dd></div>
            <div className={styles.linhaFinal}><dt>As seguintes</dt><dd><Dinheiro valor={r.valor} tom="neutro" /></dd></div>
          </dl>
          <p className={styles.efeito}>Só a cobrança de {r.proximaCobranca ? dataBR(r.proximaCobranca) : "—"} muda. As seguintes continuam {formatMoney(r.valor)}{descricao.trim() !== r.descricao ? ` como "${r.descricao}"` : ""}.</p>
        </Bloco>
        <RodapeFormulario>
          <Botao onClick={aoSair} disabled={salvando}>Cancelar</Botao>
          <Botao variante="primario" type="submit" disabled={salvando || !mudou}>{salvando ? "Salvando…" : "Salvar só esta"}</Botao>
        </RodapeFormulario>
      </Lado>
    </Formulario>
  )
}
