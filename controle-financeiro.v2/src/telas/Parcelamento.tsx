// Página de um parcelamento (/cartoes/:id/parcelamentos/:pid): o que foi comprado, quanto já foi pago e
// as parcelas uma a uma (fatura, vencimento, estado). Ações: antecipar uma parcela (página própria — debita
// a conta na hora) e cancelar uma parcela ou o parcelamento inteiro (confirmação com motivo; o servidor
// exige o motivo e recusa parcela que já foi paga ou coberta pela fatura).
import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { Ban, FastForward, XCircle } from "lucide-react"
import { ParcelamentoService } from "../services/ParcelamentoService"
import { mensagemDeErro } from "../api/cliente"
import { StatusParcela, TipoParcelamento, type ParcelaDto, type ParcelamentoDetalhe } from "../types/Parcelamento"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import BarraProgresso from "../componentes/BarraProgresso"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Confirmar from "../componentes/Confirmar"
import { Dinheiro } from "../componentes/Dinheiro"
import Entrada from "../componentes/Entrada"
import Etiqueta from "../componentes/Etiqueta"
import { RodapeFormulario } from "../componentes/Formulario"
import Menu from "../componentes/Menu"
import { diaMes, rotuloMesFatura } from "../dominio/fatura"
import { dataBR } from "../utils/dateTime"
import { formatMoney } from "../utils/money"
import styles from "./Parcelamento.module.css"

const MAX_MOTIVO = 200
const TIPO_ROTULO: Record<number, string> = { [TipoParcelamento.CompraParcelada]: "Compra parcelada", [TipoParcelamento.PIXCredito]: "Pix no crédito", [TipoParcelamento.Recorrente]: "Recorrente" }

export default function Parcelamento() {
  const { id = "", pid = "" } = useParams<{ id: string; pid: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const voltarPara = (location.state as { voltarPara?: string } | null)?.voltarPara ?? `/cartoes/${id}/parcelamentos`
  const [p, setP] = useState<ParcelamentoDetalhe | null | undefined>(undefined)
  const [erro, setErro] = useState<string | null>(null)
  // Cancelamento (parcela ou o parcelamento todo): motivo + chave de idempotência por confirmação aberta.
  const [cancelando, setCancelando] = useState<{ parcela?: ParcelaDto } | null>(null)
  const [motivo, setMotivo] = useState("")
  const [motivoErro, setMotivoErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const chave = useRef("")

  const carregar = () => ParcelamentoService.obterDetalhe(pid).then(setP).catch(() => setP(null))
  useEffect(() => { setP(undefined); void carregar() }, [pid]) // eslint-disable-line react-hooks/exhaustive-deps

  if (p === undefined) return <div className={styles.pagina}><Bloco><Esqueleto linhas={5} altura={16} /></Bloco></div>
  if (p === null) return <div className={styles.pagina}><Bloco><p className={styles.muted}>Parcelamento não encontrado.</p></Bloco></div>

  const total = p.valorComJuros ?? p.valorOriginal
  const abrirCancelar = (parcela?: ParcelaDto) => { chave.current = crypto.randomUUID(); setMotivo(""); setMotivoErro(null); setErro(null); setCancelando({ parcela }) }
  const confirmarCancelar = async () => {
    if (!cancelando) return
    const m = motivo.trim()
    if (!m) { setMotivoErro("Diga o motivo — fica no histórico."); return }
    setOcupado(true)
    try {
      if (cancelando.parcela) await ParcelamentoService.cancelarParcela(cancelando.parcela.id, { motivo: m, idempotencyKey: chave.current })
      else await ParcelamentoService.cancelar(p.id, { motivo: m, idempotencyKey: chave.current })
    } catch (e) {
      setErro(mensagemDeErro(e)); setOcupado(false); setCancelando(null); return
    }
    setOcupado(false); setCancelando(null)
    await carregar()
  }

  return (
    <div className={styles.pagina}>
      <header className={styles.cabecalho}>
        <div className={styles.identidade}>
          <span className={styles.icone}>{p.descricao.trim().charAt(0).toUpperCase() || "•"}</span>
          <div className={styles.identidadeTexto}>
            <h2 className={styles.titulo}>{p.descricao}</h2>
            <span className={styles.muted}>{p.cartaoCreditoNome} · {TIPO_ROTULO[p.tipo] ?? "Parcelamento"} · compra em {dataBR(p.dataCompra)}</span>
          </div>
        </div>
        <div className={styles.chips}>
          {!p.ativo && <Etiqueta tom="negativo">Cancelado{p.canceladoEm ? ` em ${dataBR(p.canceladoEm)}` : ""}</Etiqueta>}
          {p.taxaJuroMensal ? <Etiqueta>juros {p.taxaJuroMensal}% a.m.</Etiqueta> : null}
          <Etiqueta>{`${p.quantidadeParcelas}x de ${formatMoney(total / p.quantidadeParcelas)}`}</Etiqueta>
        </div>
      </header>

      {erro && <p className={styles.alerta} role="alert">{erro}</p>}
      {!p.ativo && p.motivoCancelamento && <p className={styles.muted}>Motivo: {p.motivoCancelamento}</p>}

      <Bloco className={styles.resumo}>
        <div className={styles.numeros}>
          <Numero rotulo="Total" valor={total} />
          <Numero rotulo="Pago" valor={p.valorPago} tom="positivo" />
          <Numero rotulo="Faltam" valor={p.valorRestante} tom={p.valorRestante > 0 ? "negativo" : "neutro"} />
        </div>
        <BarraProgresso fracao={p.parcelasPagas / p.quantidadeParcelas} tom="positivo" rotulo={`${p.parcelasPagas} de ${p.quantidadeParcelas} parcelas pagas`} />
        <span className={styles.muted}>{p.parcelasPagas} de {p.quantidadeParcelas} pagas{p.parcelasPagasAntes > 0 ? ` (${p.parcelasPagasAntes} antes de entrar no app)` : ""}</span>
      </Bloco>

      <Bloco semRespiro>
        <ul className={styles.lista}>
          {p.parcelas.map((x) => {
            const pendente = x.status === StatusParcela.Pendente
            const cancelada = x.status === StatusParcela.Cancelada
            const valor = x.valorComJuros ?? x.valor
            return (
              <li key={x.id} className={styles.linha} data-cancelada={cancelada || undefined}>
                <span className={styles.numero}>{x.numero}</span>
                <span className={styles.texto}>
                  <span className={styles.nome}>Parcela {x.numero} de {x.quantidadeTotal}</span>
                  <span className={styles.sub}>fatura de {rotuloMesFatura(x.faturaMesReferencia).toLowerCase()} · vence {diaMes(x.faturaDataVencimento)}</span>
                </span>
                {cancelada ? <Etiqueta>Cancelada{x.canceladoEm ? ` em ${dataBR(x.canceladoEm)}` : ""}</Etiqueta>
                  : x.status === StatusParcela.Paga ? <Etiqueta tom="positivo">Paga{x.pagoEm ? ` em ${dataBR(x.pagoEm)}` : ""}</Etiqueta>
                  : <Etiqueta tom="alerta">Pendente</Etiqueta>}
                <Dinheiro valor={valor} className={styles.valor} tom={cancelada ? "neutro" : undefined} />
                <span className={styles.acoes}>
                  {pendente && p.ativo && (
                    <Menu ariaLabel={`Ações da parcela ${x.numero}`} itens={[
                      { rotulo: "Antecipar parcela", icone: <FastForward size={15} strokeWidth={2.25} aria-hidden="true" />,
                        onClick: () => navigate(`/cartoes/${id}/parcelamentos/${p.id}/parcelas/${x.id}/antecipar`, { state: { voltarPara: `/cartoes/${id}/parcelamentos/${p.id}` } }) },
                      { rotulo: "Cancelar parcela", icone: <XCircle size={15} strokeWidth={2.25} aria-hidden="true" />, perigo: true, onClick: () => abrirCancelar(x) },
                    ]} />
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </Bloco>

      <RodapeFormulario>
        <Botao onClick={() => navigate(voltarPara)}>Voltar</Botao>
        {p.ativo && <Botao perigo onClick={() => abrirCancelar()} icone={<Ban size={15} strokeWidth={2.25} aria-hidden="true" />}>Cancelar parcelamento</Botao>}
      </RodapeFormulario>

      <Confirmar
        aberto={!!cancelando}
        titulo={cancelando?.parcela ? `Cancelar a parcela ${cancelando.parcela.numero} de ${cancelando.parcela.quantidadeTotal}?` : "Cancelar o parcelamento?"}
        texto={cancelando?.parcela
          ? <><Dinheiro valor={cancelando.parcela.valorComJuros ?? cancelando.parcela.valor} /> sai da fatura de {rotuloMesFatura(cancelando.parcela.faturaMesReferencia).toLowerCase()} e o limite volta. As outras parcelas continuam.</>
          : <>As parcelas pendentes saem das faturas e o limite volta. As já pagas ficam como estão. Não dá pra desfazer.</>}
        rotuloConfirmar={cancelando?.parcela ? "Cancelar parcela" : "Cancelar parcelamento"}
        rotuloCancelar={cancelando?.parcela ? "Manter parcela" : "Manter parcelamento"}
        perigo
        ocupado={ocupado}
        onConfirmar={() => { void confirmarCancelar() }}
        onCancelar={() => { if (!ocupado) setCancelando(null) }}>
        <Campo rotulo="Motivo" erro={motivoErro}>
          <Entrada value={motivo} maxLength={MAX_MOTIVO} placeholder="Compra devolvida" autoFocus
            onChange={(e) => { setMotivo(e.target.value); setMotivoErro(null) }} />
        </Campo>
      </Confirmar>
    </div>
  )
}

function Numero({ rotulo, valor, tom }: { rotulo: string; valor: number; tom?: "positivo" | "negativo" | "neutro" }) {
  return (
    <div className={styles.numeroCaixa}>
      <span className={styles.rotulo}>{rotulo}</span>
      <Dinheiro valor={valor} className={styles.numeroValor} tom={tom} />
    </div>
  )
}
