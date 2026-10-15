// Bancos (contas) do v2: três números (saldo total, disponível em conta corrente + carteira, guardado na
// poupança) e a lista de contas — abertas ou encerradas. A tela é SÓ das contas: clicar numa linha abre, ali
// embaixo, a ficha dela (banco, tipo, agência, número) e as ações (Excluir, Encerrar, Editar / Reabrir);
// o extrato mora em Transações ("Ver lançamentos" já abre filtrado). As contas vêm todas de uma vez (são
// poucas), então Abertas | Encerradas filtra a lista já carregada. Outra tela pode mandar `state.abrir`
// (id) pra chegar com aquela conta aberta — é o que Nova/Editar/Encerrar fazem ao voltar.
import { useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { ArrowRight, Ban, ChevronDown, Pencil, Plus, RotateCcw, Trash2, Wallet } from "lucide-react"
import { deleteConta, getContas, reabrirConta } from "../services/contaService"
import { mensagemDeErro } from "../api/cliente"
import type { Conta } from "../types/Conta"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Confirmar from "../componentes/Confirmar"
import { Dinheiro } from "../componentes/Dinheiro"
import { RodapeFormulario } from "../componentes/Formulario"
import LogoMarca from "../componentes/LogoMarca"
import Segmentos from "../componentes/Segmentos"
import { TIPO_CONTA, descreverConta } from "../dominio/conta"
import { dataBR } from "../utils/dateTime"
import styles from "./Bancos.module.css"

type Situacao = "abertas" | "encerradas"
const SITUACOES: { valor: Situacao; rotulo: string }[] = [
  { valor: "abertas", rotulo: "Abertas" },
  { valor: "encerradas", rotulo: "Encerradas" },
]

// Carteira primeiro, depois por nome — a carteira é a conta do dia a dia.
const ordenar = (xs: Conta[]) => xs.slice().sort((a, b) => Number(b.isCarteira) - Number(a.isCarteira) || a.nome.localeCompare(b.nome, "pt-BR"))

export default function Bancos() {
  const { state } = useLocation()
  const [contas, setContas] = useState<Conta[] | null>(null)
  const [erro, setErro] = useState(false)
  const [situacao, setSituacao] = useState<Situacao>("abertas")
  const [abertaId, setAbertaId] = useState<string | null>(() => (state as { abrir?: string } | null)?.abrir ?? null)

  useEffect(() => {
    let vivo = true
    getContas({ incluirEncerradas: true }).then((c) => { if (vivo) setContas(c) }).catch(() => { if (vivo) setErro(true) })
    return () => { vivo = false }
  }, [])
  const recarregar = () => getContas({ incluirEncerradas: true }).then(setContas)

  const abertas = useMemo(() => ordenar((contas ?? []).filter((c) => !c.encerradaEm)), [contas])
  const encerradas = useMemo(() => ordenar((contas ?? []).filter((c) => !!c.encerradaEm)), [contas])
  const visiveis = situacao === "abertas" ? abertas : encerradas

  const totais = useMemo(() => {
    if (!contas) return null
    const soma = (f: (c: Conta) => boolean) => abertas.filter(f).reduce((s, c) => s + c.saldoAtual, 0)
    return {
      total: soma(() => true),
      disponivel: soma((c) => c.tipo !== TIPO_CONTA.poupanca),
      guardado: soma((c) => c.tipo === TIPO_CONTA.poupanca),
    }
  }, [contas, abertas])

  // Chegou com uma conta encerrada pra abrir (acabou de encerrar): a lista mostra a aba dela.
  const abertaEncerrada = !!contas?.find((c) => c.id === abertaId)?.encerradaEm
  useEffect(() => { if (abertaEncerrada) setSituacao("encerradas") }, [abertaEncerrada])

  const mudou = async (o: "reaberta" | "excluida") => {
    await recarregar()
    if (o === "reaberta") setSituacao("abertas")
    else setAbertaId(null)
  }

  return (
    <div className={styles.pagina}>
      <Bloco className={styles.resumo}>
        <div className={styles.numeros}>
          <Numero rotulo="Saldo total" valor={totais?.total} />
          <Numero rotulo="Disponível" valor={totais?.disponivel} />
          <Numero rotulo="Guardado na poupança" valor={totais?.guardado} />
        </div>
      </Bloco>

      <Bloco semRespiro>
        <div className={styles.toolbar}>
          <Segmentos ariaLabel="Situação" valor={situacao} onChange={setSituacao}
            opcoes={SITUACOES.map((s) => ({ ...s, rotulo: s.valor === "encerradas" && encerradas.length > 0 ? `${s.rotulo} (${encerradas.length})` : s.rotulo }))} />
          <Link to="/bancos/nova" state={{ voltarPara: "/bancos" }} className={styles.nova}>
            <Plus size={15} strokeWidth={2.5} aria-hidden="true" /><span>Nova conta</span>
          </Link>
        </div>
        {contas === null && !erro ? (
          <div className={styles.respiro}><Esqueleto linhas={3} altura={18} /></div>
        ) : erro ? (
          <p className={styles.vazio}>Não deu pra carregar as contas.</p>
        ) : visiveis.length === 0 ? (
          <p className={styles.vazio}>{situacao === "abertas" ? "Nenhuma conta ainda." : "Nenhuma conta encerrada."}</p>
        ) : (
          <ul className={styles.lista} aria-label="Contas">
            {visiveis.map((c) => (
              <Linha key={c.id} c={c} aberta={c.id === abertaId} aoAbrir={() => setAbertaId((atual) => (atual === c.id ? null : c.id))} aoMudar={mudou} />
            ))}
          </ul>
        )}
      </Bloco>
    </div>
  )
}

function Numero({ rotulo, valor }: { rotulo: string; valor?: number }) {
  return (
    <div className={styles.numero}>
      <span className={styles.rotulo}>{rotulo}</span>
      {valor === undefined ? <span className={styles.numeroEsqueleto} />
        : <Dinheiro valor={valor} className={styles.numeroValor} tom={valor < 0 ? "negativo" : undefined} />}
    </div>
  )
}

/** Uma conta: a linha (marca, nome + detalhe, saldo, seta) e, aberta, a ficha com as ações. */
function Linha({ c, aberta, aoAbrir, aoMudar }: {
  c: Conta
  aberta: boolean
  aoAbrir: () => void
  /** A conta foi reaberta ou excluída: a lista recarrega. */
  aoMudar: (o: "reaberta" | "excluida") => Promise<void>
}) {
  const navigate = useNavigate()
  const [erro, setErro] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const encerrada = !!c.encerradaEm
  const ficha = `conta-${c.id}`

  const excluir = async () => {
    setOcupado(true); setErro(null)
    try { await deleteConta(c.id) } catch (e) { setErro(mensagemDeErro(e)); setOcupado(false); setExcluindo(false); return }
    await aoMudar("excluida")
  }
  const reabrir = async () => {
    setOcupado(true); setErro(null)
    try { await reabrirConta(c.id); await aoMudar("reaberta") } catch (e) { setErro(mensagemDeErro(e)) }
    setOcupado(false)
  }

  return (
    <li className={styles.item} data-aberta={aberta || undefined} data-encerrada={encerrada || undefined}>
      <button type="button" className={styles.linha} aria-expanded={aberta} aria-controls={ficha} onClick={aoAbrir}>
        {c.isCarteira
          ? <span className={styles.carteira} aria-hidden="true"><Wallet size={18} strokeWidth={2} /></span>
          : <LogoMarca nome={c.bancoNome || c.nome} logoUrl={c.bancoLogoUrl} cor={c.bancoCor} tamanho={36} />}
        <span className={styles.texto}>
          <span className={styles.nome}>{c.nome}</span>
          <span className={styles.sub}>{encerrada ? `Encerrada em ${dataBR(c.encerradaEm!)}` : descreverConta(c)}</span>
        </span>
        <Dinheiro valor={c.saldoAtual} className={styles.valor} tom={encerrada ? "neutro" : c.saldoAtual < 0 ? "negativo" : undefined} />
        <ChevronDown size={18} strokeWidth={2} aria-hidden="true" className={styles.seta} />
      </button>

      {aberta && (
        <div id={ficha} className={styles.ficha}>
          {erro && <p className={styles.alerta} role="alert">{erro}</p>}
          <dl className={styles.dados}>
            {c.isCarteira ? (
              <div><dt>Tipo</dt><dd>Dinheiro em mãos</dd></div>
            ) : (
              <>
                <div><dt>Banco</dt><dd>{c.bancoNome || "Sem banco"}</dd></div>
                <div><dt>Tipo</dt><dd>{c.tipo === TIPO_CONTA.poupanca ? "Poupança" : "Conta corrente"}</dd></div>
                {c.agencia && <div><dt>Agência</dt><dd>{c.agencia}</dd></div>}
                {c.numeroConta && <div><dt>Número</dt><dd>{c.numeroConta}</dd></div>}
              </>
            )}
            {encerrada && <div><dt>Encerrada em</dt><dd>{dataBR(c.encerradaEm!)}</dd></div>}
          </dl>
          <div className={styles.acoes}>
            <Link to="/transacoes" state={{ filtros: { contaId: c.id } }} className={styles.ver}>
              Ver lançamentos <ArrowRight size={14} strokeWidth={2.25} aria-hidden="true" />
            </Link>
            {!c.isCarteira && (
              <RodapeFormulario>
                <Botao perigo disabled={ocupado} onClick={() => { setErro(null); setExcluindo(true) }} icone={<Trash2 size={15} strokeWidth={2.25} aria-hidden="true" />}>Excluir</Botao>
                {encerrada ? (
                  <Botao variante="primario" disabled={ocupado} onClick={() => { void reabrir() }} icone={<RotateCcw size={15} strokeWidth={2.25} aria-hidden="true" />}>Reabrir</Botao>
                ) : (
                  <>
                    <Botao perigo onClick={() => navigate(`/bancos/${c.id}/encerrar`, { state: { voltarPara: "/bancos" } })}
                      icone={<Ban size={15} strokeWidth={2.25} aria-hidden="true" />}>Encerrar</Botao>
                    <Botao variante="primario" onClick={() => navigate(`/bancos/${c.id}/editar`, { state: { voltarPara: "/bancos" } })}
                      icone={<Pencil size={15} strokeWidth={2.25} aria-hidden="true" />}>Editar</Botao>
                  </>
                )}
              </RodapeFormulario>
            )}
          </div>
        </div>
      )}

      <Confirmar
        aberto={excluindo}
        titulo="Excluir conta?"
        texto={<>Só dá pra excluir conta sem lançamentos (criada por engano). Conta com histórico se <strong>encerra</strong>: sai das listas e o histórico fica.</>}
        rotuloConfirmar="Excluir"
        perigo
        ocupado={ocupado}
        onConfirmar={() => { void excluir() }}
        onCancelar={() => setExcluindo(false)}
      />
    </li>
  )
}
