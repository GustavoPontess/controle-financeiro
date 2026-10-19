// Guardar (/metas/:id/guardar) e tirar (/metas/:id/tirar) dinheiro de uma meta. Guardar reserva parte do saldo
// de uma conta (o dinheiro continua nela; nada de lançamento): escolhe a conta (cada uma mostra quanto tem livre)
// e o valor, que não passa do livre. Tirar solta a reserva de uma conta onde a meta tem dinheiro, até o que ela
// tem lá. A Idempotency-Key nasce ao abrir a tela e vai em todas as tentativas (duplo clique não guarda 2x).
import { useEffect, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { getContasLivres, getMeta, guardarNaMeta, tirarDaMeta } from "../services/metaService"
import { mensagemDeErro } from "../api/cliente"
import type { ContaLivre, Meta } from "../types/Meta"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import { Dinheiro } from "../componentes/Dinheiro"
import EntradaValor from "../componentes/EntradaValor"
import Formulario, { Campos, LinhaCampos, PaginaFormulario, RodapeFormulario } from "../componentes/Formulario"
import Selecao from "../componentes/Selecao"
import { formatMoney, moneyParaCampo, parseMoney } from "../utils/money"
import styles from "./MetaFormulario.module.css"

type Erros = Partial<Record<"conta" | "valor", string>>

export default function MovimentoMeta({ modo }: { modo: "guardar" | "tirar" }) {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const voltarPara = (useLocation().state as { voltarPara?: string } | null)?.voltarPara ?? "/metas"
  const guardar = modo === "guardar"
  const [meta, setMeta] = useState<Meta | null>(null)
  const [contas, setContas] = useState<ContaLivre[]>([])
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
    Promise.all([getMeta(id), guardar ? getContasLivres() : Promise.resolve([] as ContaLivre[])])
      .then(([m, c]) => {
        if (!vivo) return
        setMeta(m); setContas(c)
        // Uma opção só: já vem escolhida.
        const opcoes = guardar ? c.filter((x) => x.livre > 0) : m.reservas
        if (opcoes.length === 1) setContaId(opcoes[0].contaId)
        setCarregando(false)
      })
      .catch(() => { if (vivo) { setErroCarga("Não deu pra carregar a meta."); setCarregando(false) } })
    return () => { vivo = false }
  }, [id, guardar])

  // Guardar: o limite é o livre da conta. Tirar: o que a meta tem nela.
  const limite = guardar ? contas.find((c) => c.contaId === contaId)?.livre : meta?.reservas.find((r) => r.contaId === contaId)?.valor
  const opcoes = guardar
    ? contas.map((c) => ({ valor: c.contaId, rotulo: c.nome, detalhe: c.livre > 0 ? `${formatMoney(c.livre)} livre` : "nada livre" }))
    : (meta?.reservas ?? []).map((r) => ({ valor: r.contaId, rotulo: r.contaNome, detalhe: `${formatMoney(r.valor)} guardado` }))

  const enviar = async () => {
    setErro(null)
    const e: Erros = {}
    if (!contaId) e.conta = guardar ? "Escolha de qual conta." : "Escolha de qual conta tirar."
    const v = parseMoney(valor)
    if (!(v > 0)) e.valor = "Diga quanto."
    else if (limite !== undefined && v > limite)
      e.valor = guardar ? (limite > 0 ? `Só tem ${formatMoney(limite)} livre nessa conta.` : "Essa conta não tem dinheiro livre.") : `Nessa conta a meta só tem ${formatMoney(limite)}.`
    setErros(e)
    if (Object.keys(e).length > 0) return
    setEnviando(true)
    try {
      await (guardar ? guardarNaMeta : tirarDaMeta)(id, contaId, v, chave)
      navigate(voltarPara, { replace: true, state: { abrir: id } })
    } catch (err) {
      const msg = mensagemDeErro(err)
      if (/livre|só tem|guardado nessa conta/i.test(msg)) setErros({ valor: msg })
      else setErro(msg)
      setEnviando(false)
    }
  }

  return (
    <PaginaFormulario titulo={guardar ? `Guardar em ${meta?.nome ?? "…"}` : `Tirar de ${meta?.nome ?? "…"}`} carregando={carregando} erroCarga={erroCarga}>
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
            <Campo rotulo={guardar ? "De qual conta" : "Tirar de qual conta"} erro={erros.conta}>
              <Selecao valor={contaId} placeholder={opcoes.length === 0 ? "Nenhuma conta" : "Escolha a conta"} desabilitado={opcoes.length === 0}
                opcoes={opcoes} onChange={(x) => { setContaId(x); limpa("conta"); limpa("valor") }} />
            </Campo>
            <Campo rotulo="Quanto" erro={erros.valor}>
              <EntradaValor compacto valor={valor} autoFocus onChange={(x) => { setValor(x); limpa("valor") }} />
            </Campo>
          </LinhaCampos>
          {limite !== undefined && limite > 0 && (
            <Botao variante="texto" onClick={() => { setValor(moneyParaCampo(limite)); limpa("valor") }}>
              {guardar ? `Usar tudo que está livre (${formatMoney(limite)})` : `Tirar tudo (${formatMoney(limite)})`}
            </Botao>
          )}
        </Campos>
        <RodapeFormulario>
          <Botao onClick={() => navigate(voltarPara, { replace: true, state: { abrir: id } })} disabled={enviando}>Cancelar</Botao>
          <Botao variante="primario" type="submit" disabled={enviando}>{enviando ? (guardar ? "Guardando…" : "Tirando…") : guardar ? "Guardar" : "Tirar"}</Botao>
        </RodapeFormulario>
      </Formulario>
    </PaginaFormulario>
  )
}
