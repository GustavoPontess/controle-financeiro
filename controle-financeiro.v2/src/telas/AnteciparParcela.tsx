// Antecipar parcela (/cartoes/:id/parcelamentos/:pid/parcelas/:parcelaId/antecipar): paga agora, de uma
// conta, a parcela que cairia numa fatura futura — ela sai da fatura e o limite volta. O servidor exige
// parcela pendente, parcelamento ativo, saldo na conta e a fatura ainda com restante ≥ parcela; a chave
// de idempotência nasce com a página e vale pra toda tentativa.
import { useEffect, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { getContas } from "../services/contaService"
import { ParcelamentoService } from "../services/ParcelamentoService"
import { mensagemDeErro } from "../api/cliente"
import type { Conta } from "../types/Conta"
import { StatusParcela, type ParcelaDto, type ParcelamentoDetalhe } from "../types/Parcelamento"
import Bloco from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import { Dinheiro } from "../componentes/Dinheiro"
import Formulario, { Campos, Lado, PaginaFormulario, RodapeFormulario } from "../componentes/Formulario"
import Selecao from "../componentes/Selecao"
import SeletorData from "../componentes/SeletorData"
import { diaMes, rotuloMesFatura } from "../dominio/fatura"
import { formatMoney } from "../utils/money"
import { dataComHora, dataLocalISO, somaDias } from "../utils/dateTime"
import styles from "./PagarFatura.module.css"

export default function AnteciparParcela() {
  const { id = "", pid = "", parcelaId = "" } = useParams<{ id: string; pid: string; parcelaId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const voltarPara = (location.state as { voltarPara?: string } | null)?.voltarPara ?? `/cartoes/${id}/parcelamentos/${pid}`
  const [p, setP] = useState<ParcelamentoDetalhe | null>(null)
  const [parcela, setParcela] = useState<ParcelaDto | null>(null)
  const [contas, setContas] = useState<Conta[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    Promise.all([ParcelamentoService.obterDetalhe(pid), getContas()])
      .then(([det, cts]) => {
        if (!vivo) return
        const x = det.parcelas.find((y) => y.id === parcelaId) ?? null
        if (!x) { setErroCarga("Parcela não encontrada."); return }
        if (!det.ativo) { setErroCarga("Este parcelamento foi cancelado."); return }
        if (x.status !== StatusParcela.Pendente) { setErroCarga("Esta parcela não está pendente."); return }
        setP(det); setParcela(x); setContas(cts)
      })
      .catch(() => { if (vivo) setErroCarga("Não foi possível carregar a parcela. Recarregue a página.") })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [pid, parcelaId])

  return (
    <PaginaFormulario titulo="Antecipar parcela" carregando={carregando} erroCarga={erroCarga}>
      {p && parcela && (
        <FormularioAntecipar p={p} parcela={parcela} contas={contas}
          aoSair={() => navigate(voltarPara, { replace: true })} aoSalvo={() => navigate(voltarPara, { replace: true })} />
      )}
    </PaginaFormulario>
  )
}

type Erros = Partial<Record<"conta" | "data", string>>

function FormularioAntecipar({ p, parcela, contas, aoSair, aoSalvo }: {
  p: ParcelamentoDetalhe; parcela: ParcelaDto; contas: Conta[]; aoSair: () => void; aoSalvo: () => void
}) {
  const valor = parcela.valorComJuros ?? parcela.valor
  const hoje = dataLocalISO()
  const ontem = somaDias(hoje, -1)
  const [contaId, setContaId] = useState(() => contas.find((c) => c.isCarteira)?.id ?? contas[0]?.id ?? "")
  const [data, setData] = useState(hoje)
  const [erros, setErros] = useState<Erros>({})
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [chaveEnvio] = useState(() => crypto.randomUUID())
  const limpa = (...chaves: (keyof Erros)[]) => setErros((e) => { const n = { ...e }; for (const k of chaves) delete n[k]; return n })
  const conta = contas.find((c) => c.id === contaId)

  const validar = (): Erros => {
    const e: Erros = {}
    if (!contaId) e.conta = "Escolha de qual conta sai o dinheiro."
    if (!data) e.data = "Escolha a data."
    else if (data > hoje) e.data = "Pagamento não pode ter data futura."
    return e
  }
  const enviar = async () => {
    const e = validar()
    setErros(e)
    if (Object.keys(e).length > 0) return
    setSalvando(true); setErro(null)
    try {
      await ParcelamentoService.pagarParcelaAntecipado(parcela.id, { contaPagamentoId: contaId, dataPagamento: dataComHora(data), idempotencyKey: chaveEnvio })
      aoSalvo()
    } catch (err) {
      setErro(mensagemDeErro(err)); setSalvando(false)
    }
  }

  return (
    <Formulario layout="lateral" onSubmit={() => { void enviar() }}>
      <Campos>
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}
        <Campo rotulo="Sai da conta" erro={erros.conta}>
          <Selecao valor={contaId} desabilitado={contas.length === 0} placeholder={contas.length === 0 ? "Nenhuma conta" : "Escolha a conta"}
            onChange={(x) => { setContaId(x); limpa("conta") }} opcoes={contas.map((c) => ({ valor: c.id, rotulo: c.nome }))} />
        </Campo>
        <Campo rotulo="Data do pagamento" erro={erros.data}>
          <div className={styles.dataRapida}>
            <Botao tamanho="lg" ativo={data === hoje} onClick={() => { setData(hoje); limpa("data") }}>Hoje</Botao>
            <Botao tamanho="lg" ativo={data === ontem} onClick={() => { setData(ontem); limpa("data") }}>Ontem</Botao>
            <SeletorData valor={data} max={hoje} onChange={(x) => { setData(x); limpa("data") }} />
          </div>
        </Campo>
      </Campos>

      <Lado>
        <Bloco titulo="Como vai ficar" className={styles.previa}>
          <span className={styles.previaTitulo}>{p.descricao}</span>
          <span className={styles.muted}>parcela {parcela.numero} de {parcela.quantidadeTotal} · fatura de {rotuloMesFatura(parcela.faturaMesReferencia).toLowerCase()} · vence {diaMes(parcela.faturaDataVencimento)}</span>
          <dl className={styles.contas}>
            <div><dt>Esta parcela</dt><dd><Dinheiro valor={valor} /></dd></div>
            <div><dt>Faltam no parcelamento</dt><dd><Dinheiro valor={p.valorRestante} /></dd></div>
            <div className={styles.linhaFinal}><dt>Depois</dt><dd><Dinheiro valor={Math.max(0, Math.round((p.valorRestante - valor) * 100) / 100)} tom="neutro" /></dd></div>
          </dl>
          <p className={styles.efeito}>
            {conta ? `Sai de ${conta.nome} ${data === hoje ? "hoje" : `em ${diaMes(data)}`}. ` : ""}
            A parcela sai da fatura de {rotuloMesFatura(parcela.faturaMesReferencia).toLowerCase()} e o limite do cartão volta.
          </p>
        </Bloco>
        <RodapeFormulario>
          <Botao onClick={aoSair} disabled={salvando}>Cancelar</Botao>
          <Botao variante="primario" type="submit" disabled={salvando}>{salvando ? "Pagando…" : `Antecipar ${formatMoney(valor)}`}</Botao>
        </RodapeFormulario>
      </Lado>
    </Formulario>
  )
}
