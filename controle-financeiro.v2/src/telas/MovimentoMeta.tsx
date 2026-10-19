// Guardar (/metas/:id/guardar) e resgatar (/metas/:id/resgatar), no modelo de caixinha: guardar TIRA o dinheiro
// de uma conta e põe na caixinha da meta (vira uma transferência, fora do resultado do mês); resgatar devolve da
// caixinha pra uma conta. Guardar não passa do saldo da conta escolhida; resgatar não passa do guardado.
// A Idempotency-Key nasce ao abrir a tela e vai em todas as tentativas (duplo clique não move 2x).
import { useEffect, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { getMeta, guardarNaMeta, resgatarDaMeta } from "../services/metaService"
import { getContas } from "../services/contaService"
import { mensagemDeErro } from "../api/cliente"
import type { Conta } from "../types/Conta"
import type { Meta } from "../types/Meta"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import { Dinheiro } from "../componentes/Dinheiro"
import EntradaValor from "../componentes/EntradaValor"
import Formulario, { Campos, LinhaCampos, PaginaFormulario, RodapeFormulario } from "../componentes/Formulario"
import Selecao from "../componentes/Selecao"
import { dataLocalISO } from "../utils/dateTime"
import { formatMoney, moneyParaCampo, parseMoney } from "../utils/money"
import styles from "./MetaFormulario.module.css"

type Erros = Partial<Record<"conta" | "valor", string>>

export default function MovimentoMeta({ modo }: { modo: "guardar" | "resgatar" }) {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const voltarPara = (useLocation().state as { voltarPara?: string } | null)?.voltarPara ?? `/metas/${id}`
  const guardar = modo === "guardar"
  const [meta, setMeta] = useState<Meta | null>(null)
  const [contas, setContas] = useState<Conta[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [contaId, setContaId] = useState("")
  const [valor, setValor] = useState("")
  const [erros, setErros] = useState<Erros>({})
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [chave] = useState(() => crypto.randomUUID())
  const limpa = (k: keyof Erros) => setErros((e) => ({ ...e, [k]: undefined }))

  useEffect(() => {
    let vivo = true
    Promise.all([getMeta(id), getContas()])
      .then(([m, c]) => {
        if (!vivo) return
        setMeta(m); setContas(c)
        // Guardar: só uma conta com saldo, já vem escolhida. Resgatar: uma conta só, idem.
        const opcoes = guardar ? c.filter((x) => x.saldoAtual > 0) : c
        if (opcoes.length === 1) setContaId(opcoes[0].id)
        setCarregando(false)
      })
      .catch(() => { if (vivo) { setErroCarga("Não deu pra carregar a meta."); setCarregando(false) } })
    return () => { vivo = false }
  }, [id, guardar])

  // Guardar: o teto é o saldo da conta. Resgatar: o que a meta tem.
  const saldoDaConta = contas.find((c) => c.id === contaId)?.saldoAtual
  const limite = guardar ? saldoDaConta : meta?.guardado
  const opcoes = contas.map((c) => ({ valor: c.id, rotulo: c.nome, detalhe: `${formatMoney(c.saldoAtual)} na conta` }))

  const enviar = async () => {
    setErro(null)
    const e: Erros = {}
    if (!contaId) e.conta = guardar ? "Escolha de qual conta sai." : "Escolha pra qual conta volta."
    const v = parseMoney(valor)
    if (!(v > 0)) e.valor = "Diga quanto."
    else if (limite !== undefined && v > limite)
      e.valor = guardar
        ? (limite > 0 ? `Só tem ${formatMoney(limite)} nessa conta.` : "Essa conta está sem saldo pra guardar.")
        : `A meta só tem ${formatMoney(limite)} guardado.`
    setErros(e)
    if (Object.keys(e).length > 0) return
    setEnviando(true)
    try {
      await (guardar ? guardarNaMeta : resgatarDaMeta)(id, contaId, v, dataLocalISO(), chave)
      navigate(voltarPara, { replace: true })
    } catch (err) {
      const msg = mensagemDeErro(err)
      if (/só tem|sem saldo|nada guardado/i.test(msg)) setErros({ valor: msg })
      else setErro(msg)
      setEnviando(false)
    }
  }

  return (
    <PaginaFormulario titulo={guardar ? `Guardar em ${meta?.nome ?? "…"}` : `Resgatar de ${meta?.nome ?? "…"}`} carregando={carregando} erroCarga={erroCarga}>
      <Formulario onSubmit={() => { void enviar() }}>
        <Campos>
          {erro && <p className={styles.alerta} role="alert">{erro}</p>}
          {meta && (
            <div className={styles.resumo}>
              <span>Guardado <strong><Dinheiro valor={meta.guardado} /></strong> de <Dinheiro valor={meta.valorAlvo} /></span>
              {meta.falta > 0 && <span>Falta <strong><Dinheiro valor={meta.falta} /></strong></span>}
              {meta.porMes !== null && <span>Por mês pra chegar no prazo <strong><Dinheiro valor={meta.porMes} /></strong></span>}
            </div>
          )}
          <LinhaCampos colunas="minmax(0, 2fr) minmax(0, 1fr)">
            <Campo rotulo={guardar ? "De qual conta sai" : "Pra qual conta volta"} erro={erros.conta}>
              <Selecao valor={contaId} placeholder={opcoes.length === 0 ? "Nenhuma conta" : "Escolha a conta"} desabilitado={opcoes.length === 0}
                invalido={!!erros.conta} opcoes={opcoes} onChange={(x) => { setContaId(x); limpa("conta"); limpa("valor") }} />
            </Campo>
            <Campo rotulo="Quanto" erro={erros.valor}>
              <EntradaValor compacto valor={valor} autoFocus onChange={(x) => { setValor(x); limpa("valor") }} />
            </Campo>
          </LinhaCampos>
          {limite !== undefined && limite > 0 && (
            <Botao variante="texto" onClick={() => { setValor(moneyParaCampo(limite)); limpa("valor") }}>
              {guardar ? `Guardar tudo que tem na conta (${formatMoney(limite)})` : `Resgatar tudo (${formatMoney(limite)})`}
            </Botao>
          )}
        </Campos>
        <RodapeFormulario>
          <Botao onClick={() => navigate(voltarPara, { replace: true })} disabled={enviando}>Cancelar</Botao>
          <Botao variante="primario" type="submit" disabled={enviando}>{enviando ? (guardar ? "Guardando…" : "Resgatando…") : guardar ? "Guardar" : "Resgatar"}</Botao>
        </RodapeFormulario>
      </Formulario>
    </PaginaFormulario>
  )
}
