// Pagar fatura em página (/cartoes/:id/faturas/:faturaId/pagar): valor (tudo ou parte), de qual conta
// sai, meio e data; prévia "Como vai ficar" com o restante antes e depois. A Idempotency-Key nasce com a
// página e vale pra toda tentativa — retry de rede não paga 2x. Pagamento é dinheiro que já saiu da
// conta: a data não pode ser futura (o servidor também recusa).
import { useEffect, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { getCartoes } from "../services/cartaoCreditoService"
import { getContas } from "../services/contaService"
import { getFaturasByCartao, pagarFatura } from "../services/faturaService"
import { mensagemDeErro } from "../api/cliente"
import type { CartaoCredito } from "../types/CartaoCredito"
import type { Conta } from "../types/Conta"
import type { Fatura } from "../types/Fatura"
import Bloco from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import { Dinheiro } from "../componentes/Dinheiro"
import EntradaValor from "../componentes/EntradaValor"
import Etiqueta from "../componentes/Etiqueta"
import Formulario, { Campos, Lado, LinhaCampos, PaginaFormulario, RodapeFormulario } from "../componentes/Formulario"
import Selecao from "../componentes/Selecao"
import SeletorData from "../componentes/SeletorData"
import { MEIO, MEIOS_CONTA } from "../dominio/transacao"
import { diaMes, rotuloMesFatura } from "../dominio/fatura"
import { formatMoney, moneyParaCampo, parseMoney } from "../utils/money"
import { dataComHora, dataLocalISO, somaDias } from "../utils/dateTime"
import styles from "./PagarFatura.module.css"

export default function PagarFatura() {
  const { id = "", faturaId = "" } = useParams<{ id: string; faturaId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const voltarPara = (location.state as { voltarPara?: string } | null)?.voltarPara ?? `/cartoes/${id}`
  const [cartao, setCartao] = useState<CartaoCredito | null>(null)
  const [fatura, setFatura] = useState<Fatura | null>(null)
  const [contas, setContas] = useState<Conta[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    Promise.all([getCartoes(), getFaturasByCartao(id), getContas()])
      .then(([cards, faturas, cts]) => {
        if (!vivo) return
        const c = cards.find((x) => x.id === id) ?? null
        const f = faturas.find((x) => x.id === faturaId) ?? null
        if (!c || !f) { setErroCarga("Fatura não encontrada."); return }
        if (f.valorRestante <= 0) { setErroCarga("Esta fatura já está paga."); return }
        setCartao(c); setFatura(f); setContas(cts)
      })
      .catch(() => { if (vivo) setErroCarga("Não foi possível carregar a fatura. Recarregue a página.") })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [id, faturaId])

  return (
    <PaginaFormulario titulo="Pagar fatura" carregando={carregando} erroCarga={erroCarga}>
      {cartao && fatura && (
        <FormularioPagamento cartao={cartao} fatura={fatura} contas={contas}
          aoSair={() => navigate(voltarPara, { replace: true })}
          aoSalvo={() => navigate(voltarPara, { replace: true })} />
      )}
    </PaginaFormulario>
  )
}

type Erros = Partial<Record<"valor" | "conta" | "data", string>>
const centavos = (n: number) => Math.round(n * 100) / 100

function FormularioPagamento({ cartao, fatura, contas, aoSair, aoSalvo }: {
  cartao: CartaoCredito; fatura: Fatura; contas: Conta[]; aoSair: () => void; aoSalvo: () => void
}) {
  const restante = fatura.valorRestante
  const hoje = dataLocalISO()
  const ontem = somaDias(hoje, -1)
  const [valor, setValor] = useState(moneyParaCampo(restante))
  // Conta: a vinculada ao cartão; senão a carteira; senão a primeira.
  const [contaId, setContaId] = useState(() =>
    (cartao.contaId && contas.some((c) => c.id === cartao.contaId)) ? cartao.contaId
      : (contas.find((c) => c.isCarteira)?.id ?? contas[0]?.id ?? ""))
  const [meio, setMeio] = useState<number>(MEIO.pix)
  const [data, setData] = useState(hoje)
  const [erros, setErros] = useState<Erros>({})
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [chaveEnvio] = useState(() => crypto.randomUUID())
  const limpa = (...chaves: (keyof Erros)[]) => setErros((e) => { const n = { ...e }; for (const k of chaves) delete n[k]; return n })

  const v = centavos(parseMoney(valor))
  const pagando = v > 0 ? Math.min(v, restante) : 0
  const depois = centavos(Math.max(0, restante - pagando))
  const tudo = v > 0 && Math.abs(v - restante) < 0.005
  const conta = contas.find((c) => c.id === contaId)

  const validar = (): Erros => {
    const e: Erros = {}
    if (!(v > 0)) e.valor = "Informe quanto vai pagar."
    else if (v > restante + 0.004) e.valor = `No máximo o restante: ${formatMoney(restante)}.`
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
      await pagarFatura(cartao.id, fatura.id, { contaId, valor: v, dataPagamento: dataComHora(data), meioPagamento: meio }, chaveEnvio)
      aoSalvo()
    } catch (err) {
      setErro(mensagemDeErro(err)); setSalvando(false)
    }
  }

  return (
    <Formulario layout="lateral" onSubmit={() => { void enviar() }}>
      <Campos>
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}

        <Campo rotulo="Valor" erro={erros.valor}>
          <EntradaValor valor={valor} tom="neutro" autoFocus onChange={(x) => { setValor(x); limpa("valor") }} />
        </Campo>
        <div className={styles.atalhos}>
          <Botao ativo={tudo} onClick={() => { setValor(moneyParaCampo(restante)); limpa("valor") }}>Pagar tudo · {formatMoney(restante)}</Botao>
        </div>

        <LinhaCampos>
          <Campo rotulo="Sai da conta" erro={erros.conta}>
            <Selecao valor={contaId} desabilitado={contas.length === 0} placeholder={contas.length === 0 ? "Nenhuma conta" : "Escolha a conta"}
              onChange={(x) => { setContaId(x); limpa("conta") }} opcoes={contas.map((c) => ({ valor: c.id, rotulo: c.nome }))} />
          </Campo>
          <Campo rotulo="Meio">
            <Selecao valor={String(meio)} onChange={(x) => setMeio(Number(x))}
              opcoes={MEIOS_CONTA.map((m) => ({ valor: String(m.valor), rotulo: m.rotulo }))} />
          </Campo>
        </LinhaCampos>

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
          <span className={styles.previaTitulo}>Fatura de {rotuloMesFatura(fatura.dataFechamento).toLowerCase()}</span>
          <span className={styles.muted}>
            vence {diaMes(fatura.dataVencimento)} · total <Dinheiro valor={fatura.valorTotal} />
            {fatura.valorPago > 0 && <> · já pagos <Dinheiro valor={fatura.valorPago} /></>}
          </span>
          <dl className={styles.contas}>
            <div><dt>Restante hoje</dt><dd><Dinheiro valor={restante} /></dd></div>
            <div><dt>Este pagamento</dt><dd><Dinheiro valor={pagando} tom={pagando > 0 ? "positivo" : "neutro"} /></dd></div>
            <div className={styles.linhaFinal}><dt>Depois</dt><dd><Dinheiro valor={depois} tom={depois > 0 ? "negativo" : "neutro"} /></dd></div>
          </dl>
          {pagando > 0 && (
            <div className={styles.etiquetas}>
              {depois === 0 ? <Etiqueta tom="positivo">Fatura paga</Etiqueta> : <Etiqueta tom="alerta">Pagamento parcial</Etiqueta>}
            </div>
          )}
          {conta && pagando > 0 && <p className={styles.efeito}>Sai de {conta.nome} {data === hoje ? "hoje" : `em ${diaMes(data)}`}.</p>}
        </Bloco>
        <RodapeFormulario>
          <Botao onClick={aoSair} disabled={salvando}>Cancelar</Botao>
          <Botao variante="primario" type="submit" disabled={salvando}>
            {salvando ? "Pagando…" : pagando > 0 ? `Pagar ${formatMoney(pagando)}` : "Pagar"}
          </Botao>
        </RodapeFormulario>
      </Lado>
    </Formulario>
  )
}
