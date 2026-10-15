// Encerrar conta (/bancos/:id/encerrar): conta fechada no banco sai das listas e não recebe lançamento novo;
// o histórico fica e dá pra reabrir. O saldo nunca some de vista — zerado, encerra direto; com saldo, a
// pessoa diz o que aconteceu: foi pra outra conta (vira transferência) ou no banco já está zerado (vira
// ajuste). A chave de idempotência nasce com a página: reenviar não transfere 2x.
import { useEffect, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { encerrarConta, getConta, getContas } from "../services/contaService"
import { mensagemDeErro } from "../api/cliente"
import type { Conta } from "../types/Conta"
import Bloco from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import { Dinheiro } from "../componentes/Dinheiro"
import Formulario, { Campos, Lado, PaginaFormulario, RodapeFormulario } from "../componentes/Formulario"
import Segmentos from "../componentes/Segmentos"
import Selecao from "../componentes/Selecao"
import SeletorData from "../componentes/SeletorData"
import { dataLocalISO, somaDias } from "../utils/dateTime"
import { formatMoney } from "../utils/money"
import styles from "./PagarFatura.module.css"

export default function EncerrarConta() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const voltarPara = (location.state as { voltarPara?: string } | null)?.voltarPara ?? `/bancos/${id}`
  const [conta, setConta] = useState<Conta | null>(null)
  const [outras, setOutras] = useState<Conta[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    Promise.all([getConta(id), getContas()])
      .then(([c, todas]) => {
        if (!vivo) return
        if (c.isCarteira) { setErroCarga("A carteira não se encerra."); return }
        if (c.encerradaEm) { setErroCarga("Esta conta já está encerrada."); return }
        setConta(c); setOutras(todas.filter((x) => x.id !== c.id))
      })
      .catch(() => { if (vivo) setErroCarga("Não foi possível carregar a conta. Recarregue a página.") })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [id])

  return (
    <PaginaFormulario titulo="Encerrar conta" carregando={carregando} erroCarga={erroCarga}>
      {conta && <FormularioEncerrar conta={conta} outras={outras} aoSair={() => navigate(voltarPara, { replace: true })}
        aoSalvo={() => navigate("/bancos", { replace: true, state: { abrir: conta.id } })} />}
    </PaginaFormulario>
  )
}

type Resolucao = "transferir" | "ajustar"
const RESOLUCOES: { valor: Resolucao; rotulo: string }[] = [
  { valor: "transferir", rotulo: "Transferi pra outra conta" },
  { valor: "ajustar", rotulo: "No banco já está zerado" },
]
type Erros = Partial<Record<"destino" | "data", string>>

function FormularioEncerrar({ conta, outras, aoSair, aoSalvo }: { conta: Conta; outras: Conta[]; aoSair: () => void; aoSalvo: () => void }) {
  const saldo = conta.saldoAtual
  const temSaldo = saldo !== 0
  const hoje = dataLocalISO()
  const ontem = somaDias(hoje, -1)
  const [resolucao, setResolucao] = useState<Resolucao>("transferir")
  const [destinoId, setDestinoId] = useState(() => outras.find((c) => c.isCarteira)?.id ?? outras[0]?.id ?? "")
  const [data, setData] = useState(hoje)
  const [erros, setErros] = useState<Erros>({})
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [chaveEnvio] = useState(() => crypto.randomUUID())
  const limpa = (...chaves: (keyof Erros)[]) => setErros((e) => { const n = { ...e }; for (const k of chaves) delete n[k]; return n })
  const destino = outras.find((c) => c.id === destinoId)
  const transferir = temSaldo && resolucao === "transferir"

  const enviar = async () => {
    const e: Erros = {}
    if (transferir && !destinoId) e.destino = "Escolha pra qual conta foi o dinheiro."
    if (temSaldo && data > hoje) e.data = "Não pode ser no futuro."
    setErros(e)
    if (Object.keys(e).length > 0) return
    setSalvando(true); setErro(null)
    try {
      await encerrarConta(conta.id, !temSaldo ? {} : transferir ? { contaDestinoId: destinoId, data } : { ajustar: true, data }, chaveEnvio)
      aoSalvo()
    } catch (err) {
      setErro(mensagemDeErro(err)); setSalvando(false)
    }
  }

  return (
    <Formulario layout="lateral" onSubmit={() => { void enviar() }}>
      <Campos>
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}
        <Campo rotulo="Saldo de hoje" estatico>
          <Dinheiro valor={saldo} className={styles.saldoGrande} tom={saldo < 0 ? "negativo" : undefined} />
        </Campo>
        {temSaldo && (
          <>
            <Campo rotulo="O que aconteceu com esse dinheiro?" grupo>
              <Segmentos ariaLabel="O que aconteceu com o saldo" cheio valor={resolucao} onChange={(v) => { setResolucao(v); limpa("destino") }} opcoes={RESOLUCOES} />
            </Campo>
            {transferir && (
              <Campo rotulo={saldo > 0 ? "Pra qual conta foi" : "De qual conta veio pra cobrir"} erro={erros.destino}>
                <Selecao valor={destinoId} desabilitado={outras.length === 0} placeholder={outras.length === 0 ? "Nenhuma outra conta" : "Escolha a conta"}
                  onChange={(x) => { setDestinoId(x); limpa("destino") }} opcoes={outras.map((c) => ({ valor: c.id, rotulo: c.nome }))} />
              </Campo>
            )}
            <Campo rotulo="Quando" erro={erros.data}>
              <div className={styles.dataRapida}>
                <Botao tamanho="lg" ativo={data === hoje} onClick={() => { setData(hoje); limpa("data") }}>Hoje</Botao>
                <Botao tamanho="lg" ativo={data === ontem} onClick={() => { setData(ontem); limpa("data") }}>Ontem</Botao>
                <SeletorData valor={data} max={hoje} onChange={(x) => { setData(x); limpa("data") }} />
              </div>
            </Campo>
          </>
        )}
      </Campos>

      <Lado>
        <Bloco titulo="Como vai ficar" className={styles.previa}>
          <span className={styles.previaTitulo}>{conta.nome}</span>
          <dl className={styles.contas}>
            <div><dt>Saldo hoje</dt><dd><Dinheiro valor={saldo} /></dd></div>
            {temSaldo && (transferir
              ? <div><dt>{saldo > 0 ? `Vai pra ${destino?.nome ?? "…"}` : `Vem de ${destino?.nome ?? "…"}`}</dt><dd><Dinheiro valor={Math.abs(saldo)} /></dd></div>
              : <div><dt>Ajuste</dt><dd><Dinheiro valor={Math.abs(saldo)} /></dd></div>)}
            <div className={styles.linhaFinal}><dt>Depois</dt><dd><Dinheiro valor={0} tom="neutro" /></dd></div>
          </dl>
          <p className={styles.efeito}>
            {temSaldo && transferir && destino ? `Fica registrada uma transferência de ${formatMoney(Math.abs(saldo))} ${saldo > 0 ? `pra ${destino.nome}` : `de ${destino.nome}`}. ` : ""}
            {temSaldo && !transferir ? "Fica registrado um ajuste (não conta como gasto nem como ganho). " : ""}
            A conta sai das listas; o histórico fica em Transações e Relatórios. Dá pra reabrir depois.
          </p>
        </Bloco>
        <RodapeFormulario>
          <Botao onClick={aoSair} disabled={salvando}>Cancelar</Botao>
          <Botao variante="primario" perigo type="submit" disabled={salvando}>{salvando ? "Encerrando…" : "Encerrar conta"}</Botao>
        </RodapeFormulario>
      </Lado>
    </Formulario>
  )
}
