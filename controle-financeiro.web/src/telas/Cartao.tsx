// Página de um cartão do v2: faixa de meses em cima (uma fatura por mês, inclusive meses sem lançamento),
// a fatura escolhida embaixo (quanto deve, fecha/vence, pago, lançamentos por dia) e, na coluna da direita,
// limite, o número de parcelamentos e as ações (pagar, editar, excluir). Parcelamentos têm página própria
// (/cartoes/:id/parcelamentos, podem ser muitos) — aqui fica só o número e o "Ver todos".
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Banknote, Pencil, Trash2 } from "lucide-react"
import { deleteCartao, dispensarSugestaoContaFixa, getCartoes, getSugestoesContaFixa } from "../services/cartaoCreditoService"
import { getFaturaDetalhe, getFaturasByCartao, getLancamentosFatura } from "../services/faturaService"
import { ParcelamentoService } from "../services/ParcelamentoService"
import { mensagemDeErro } from "../api/cliente"
import type { CartaoCredito, SugestaoContaFixa } from "../types/CartaoCredito"
import type { Fatura, FaturaDetalhe, LancamentoFatura, TipoLancamentoFatura } from "../types/Fatura"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Busca from "../componentes/Busca"
import BarraProgresso from "../componentes/BarraProgresso"
import Confirmar from "../componentes/Confirmar"
import { Dinheiro } from "../componentes/Dinheiro"
import Etiqueta from "../componentes/Etiqueta"
import FaceCartao from "../componentes/FaceCartao"
import { RodapeFormulario } from "../componentes/Formulario"
import ListaPorDia, { type ItemDoDia } from "../componentes/ListaPorDia"
import Paginacao, { TAMANHOS } from "../componentes/Paginacao"
import Selecao from "../componentes/Selecao"
import { useAtrasado } from "../utils/useAtrasado"
import { NOME_BANDEIRA, diaMes, estadoDaFatura, indiceMes, indiceMesDeHoje, mesCurto, montarCiclos, rotuloMesFatura, type Ciclo } from "../dominio/fatura"
import { marcarCartaoDaCasa } from "../services/familiaService"
import DaCasa from "./DaCasa"
import styles from "./Cartao.module.css"
import { agora } from "../utils/dateTime"

export default function Cartao() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [cartao, setCartao] = useState<CartaoCredito | null | undefined>(undefined)
  const [faturas, setFaturas] = useState<Fatura[] | null>(null)
  const [stats, setStats] = useState<{ ativos: number; totalRestante: number } | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const hoje = useMemo(() => agora(), [])

  useEffect(() => {
    let vivo = true
    setCartao(undefined); setFaturas(null); setStats(null)
    getCartoes().then((cs) => {
      if (!vivo) return
      const c = cs.find((x) => x.id === id) ?? null
      setCartao(c)
      if (!c) return
      if (c.temCredito) getFaturasByCartao(c.id).then((fs) => { if (vivo) setFaturas(fs) }).catch(() => { if (vivo) setFaturas([]) })
      else setFaturas([])
      ParcelamentoService.obterStats(c.id).then((s) => { if (vivo) setStats(s) }).catch(() => { /* fica sem número */ })
    }).catch(() => { if (vivo) setCartao(null) })
    return () => { vivo = false }
  }, [id])

  const ciclos = useMemo(() => cartao && faturas
    ? montarCiclos({ reais: faturas, hoje, cartaoId: cartao.id, cartaoNome: cartao.nome, diaFechamento: cartao.diaFechamento, diaVencimento: cartao.diaVencimento })
    : null, [cartao, faturas, hoje])
  const mesHoje = cartao ? indiceMesDeHoje(hoje, cartao.diaFechamento) : 0

  const excluir = async () => {
    if (!cartao) return
    setOcupado(true); setErro(null)
    try { await deleteCartao(cartao.id) } catch (e) { setErro(mensagemDeErro(e)); setOcupado(false); setExcluindo(false); return }
    navigate("/cartoes", { replace: true })
  }

  if (cartao === undefined) return <div className={styles.pagina}><Bloco><Esqueleto linhas={5} altura={16} /></Bloco></div>
  if (cartao === null)
    return (
      <div className={styles.pagina}>
        <h1 className={styles.titulo}>Cartão não encontrado</h1>
        <p className={styles.muted}>Ele pode ter sido removido.</p>
      </div>
    )

  const limite = cartao.limite ?? 0
  const usado = cartao.limiteUsado ?? 0

  return (
    <div className={styles.pagina}>
      <header className={styles.cabecalho}>
        <div className={styles.identidade}>
          <FaceCartao bandeira={cartao.bandeira} cor={cartao.bancoCor} ultimosDigitos={cartao.ultimosDigitos} tamanho="lg" />
          <div className={styles.identidadeTexto}>
            <h1 className={styles.titulo}>{cartao.nome}</h1>
            <span className={styles.muted}>{[cartao.bancoNome, cartao.temCredito && cartao.diaFechamento ? `fecha dia ${cartao.diaFechamento}` : null, cartao.temCredito && cartao.diaVencimento ? `vence dia ${cartao.diaVencimento}` : null].filter(Boolean).join(" · ")}</span>
          </div>
        </div>
        <div className={styles.chips}>
          <Etiqueta>{NOME_BANDEIRA[cartao.bandeira] ?? "Cartão"}</Etiqueta>
          {cartao.ultimosDigitos && <Etiqueta>•••• {cartao.ultimosDigitos}</Etiqueta>}
          {!cartao.temCredito && <Etiqueta>Só débito</Etiqueta>}
          {cartao.ehPrePago && <Etiqueta>Pré-pago</Etiqueta>}
        </div>
      </header>

      {erro && <p className={styles.alerta} role="alert">{erro}</p>}

      <div className={styles.grade}>
        <div className={styles.principal}>
          {!cartao.temCredito ? (
            <Bloco><p className={styles.muted}>Este cartão só tem função débito: os lançamentos dele aparecem na conta vinculada.</p></Bloco>
          ) : (
            <Faturas cartao={cartao} ciclos={ciclos} mesHoje={mesHoje} hoje={hoje} />
          )}
        </div>

        <aside className={styles.lado}>
          {cartao.temCredito && (
            <Bloco titulo="Limite">
              {limite > 0 ? (
                <div className={styles.limite}>
                  <Dinheiro valor={cartao.limiteDisponivel ?? 0} className={styles.limiteGrande} />
                  <span className={styles.muted}>disponível de <Dinheiro valor={limite} /></span>
                  <BarraProgresso fracao={usado / limite} tom={usado / limite >= 0.9 ? "alerta" : undefined} rotulo={`${Math.round((usado / limite) * 100)}% do limite usado`} />
                  <span className={styles.muted}>usado <Dinheiro valor={usado} /></span>
                </div>
              ) : <p className={styles.muted}>Sem limite cadastrado.</p>}
            </Bloco>
          )}
          {cartao.temCredito && (
            <Bloco titulo="Parcelamentos" acao={stats && stats.ativos > 0 ? "Ver todos" : undefined}
              aoClicar={() => navigate(`/cartoes/${cartao.id}/parcelamentos`, { state: { voltarPara: `/cartoes/${cartao.id}` } })}>
              {!stats ? <Esqueleto linhas={2} altura={14} /> : stats.ativos === 0 ? <p className={styles.muted}>Nenhum em andamento.</p> : (
                <div className={styles.limite}>
                  <span className={styles.limiteGrande}>{stats.ativos} em andamento</span>
                  <span className={styles.muted}>faltam <Dinheiro valor={stats.totalRestante} /></span>
                </div>
              )}
            </Bloco>
          )}
          {cartao.temCredito && <SugestoesContaFixa cartaoId={cartao.id} />}
          {/* Cartão da casa: as compras à vista daqui pra frente já nascem divididas. */}
          {cartao.temCredito && <DaCasa tipo="cartao" emBloco familiaId={cartao.familiaId} aoMudar={(fid) => marcarCartaoDaCasa(cartao.id, fid)} />}
          <RodapeFormulario>
            <Botao perigo onClick={() => { setErro(null); setExcluindo(true) }} icone={<Trash2 size={15} strokeWidth={2.25} aria-hidden="true" />}>Excluir</Botao>
            <Botao onClick={() => navigate(`/cartoes/${cartao.id}/editar`, { state: { voltarPara: `/cartoes/${cartao.id}` } })} icone={<Pencil size={15} strokeWidth={2.25} aria-hidden="true" />}>Editar cartão</Botao>
          </RodapeFormulario>
        </aside>
      </div>

      <Confirmar
        aberto={excluindo}
        titulo="Excluir cartão?"
        texto={<>{cartao.nome} sai da lista. Cartão com fatura em aberto não pode ser excluído.</>}
        rotuloConfirmar="Excluir"
        perigo
        ocupado={ocupado}
        onConfirmar={() => { void excluir() }}
        onCancelar={() => setExcluindo(false)}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────── cobranças que parecem conta fixa

/** Assinaturas do cartão (fatura-a-detalhar.md, passo 5): o app só sugere. "Virar conta fixa" abre Nova conta fixa
 *  preenchida (a pessoa confere e salva); "Não é" não mostra mais aquele lugar. Sem sugestão, o bloco não aparece. */
function SugestoesContaFixa({ cartaoId }: { cartaoId: string }) {
  const navigate = useNavigate()
  const [itens, setItens] = useState<SugestaoContaFixa[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    getSugestoesContaFixa(cartaoId).then((s) => { if (vivo) setItens(s) }).catch(() => { /* fica sem sugestão */ })
    return () => { vivo = false }
  }, [cartaoId])

  if (itens.length === 0) return null
  const dispensar = async (s: SugestaoContaFixa) => {
    setErro(null); setOcupado(s.chave)
    try {
      await dispensarSugestaoContaFixa(cartaoId, s.chave)
      setItens((v) => v.filter((x) => x.chave !== s.chave))
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setOcupado(null)
    }
  }
  return (
    <Bloco titulo="Parece conta fixa">
      {erro && <p className={styles.alerta} role="alert">{erro}</p>}
      <ul className={styles.sugestoes} aria-label="Sugestões de conta fixa">
        {itens.map((s) => (
          <li key={s.chave} className={styles.sugestao}>
            <div className={styles.sugestaoTexto}>
              <strong>{s.nome}</strong>
              <span className={styles.muted}><Dinheiro valor={s.valor} /> · {s.meses} faturas seguidas</span>
            </div>
            <div className={styles.sugestaoAcoes}>
              <Botao variante="texto" disabled={ocupado === s.chave} onClick={() => { void dispensar(s) }}>Não é</Botao>
              <Botao onClick={() => navigate("/contas-fixas/nova", {
                state: { voltarPara: `/cartoes/${cartaoId}`, sugestao: { descricao: s.nome, valor: s.valor, cartaoCreditoId: cartaoId,
                  categoriaId: s.categoriaId ?? undefined, subcategoriaId: s.subcategoriaId ?? undefined, dataInicio: s.proxima } },
              })}>Virar conta fixa</Botao>
            </div>
          </li>
        ))}
      </ul>
    </Bloco>
  )
}

// ─────────────────────────────────────────────────────────────────────────── faturas

function Faturas({ cartao, ciclos, mesHoje, hoje }: { cartao: CartaoCredito; ciclos: Ciclo[] | null; mesHoje: number; hoje: Date }) {
  const navigate = useNavigate()
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const [detalhe, setDetalhe] = useState<FaturaDetalhe | null>(null)
  const faixa = useRef<HTMLDivElement | null>(null)

  // Abre no mês de hoje; a faixa rola até ele.
  const atual = ciclos?.find((c) => indiceMes(c.dataFechamento) === mesHoje) ?? null
  const ativo = ciclos?.find((c) => c.id === escolhido) ?? atual
  useEffect(() => {
    if (!ativo) return
    faixa.current?.querySelector<HTMLElement>(`[data-ciclo="${ativo.id}"]`)?.scrollIntoView({ block: "nearest", inline: "center" })
  }, [ativo])

  useEffect(() => {
    if (!ativo || ativo.vazia) { setDetalhe(null); return }
    let vivo = true
    getFaturaDetalhe(cartao.id, ativo.id).then((d) => { if (vivo) setDetalhe(d) }).catch(() => { if (vivo) setDetalhe(null) })
    return () => { vivo = false }
  }, [cartao.id, ativo])

  if (!ciclos || !ativo) return <Bloco><Esqueleto linhas={4} altura={16} /></Bloco>
  const estado = estadoDaFatura(ativo, hoje)
  const total = ativo.valorTotal
  const qtd = detalhe ? detalhe.transacoes.length + detalhe.parcelas.length : 0

  return (
    <>
      <div ref={faixa} className={styles.meses} role="tablist" aria-label="Faturas por mês">
        {ciclos.map((c) => {
          const i = indiceMes(c.dataFechamento)
          return (
            <button key={c.id} type="button" role="tab" aria-selected={c.id === ativo.id} data-ciclo={c.id}
              className={styles.mes} data-ativo={c.id === ativo.id || undefined} data-futuro={i > mesHoje || undefined} data-hoje={i === mesHoje || undefined}
              onClick={() => setEscolhido(c.id)}>
              <span className={styles.mesNome}>{mesCurto(c.dataFechamento, hoje.getFullYear())}</span>
              <span className={styles.mesValor}>{c.vazia || c.valorTotal === 0 ? "Sem compras" : <Dinheiro valor={c.valorTotal} />}</span>
            </button>
          )
        })}
      </div>

      <Bloco className={styles.fatura}>
        <div className={styles.faturaTopo}>
          <div className={styles.faturaTexto}>
            <span className={styles.faturaRotulo}>Fatura de {rotuloMesFatura(ativo.dataFechamento).toLowerCase()}</span>
            <span className={styles.muted}>fecha {diaMes(ativo.dataFechamento)} · vence {diaMes(ativo.dataVencimento)}</span>
          </div>
          <Etiqueta tom={estado.tom}>{estado.rotulo}</Etiqueta>
        </div>
        {ativo.vazia ? (
          <p className={styles.muted}>Nenhum lançamento neste mês.</p>
        ) : (
          <>
            <Dinheiro valor={ativo.valorRestante} className={styles.faturaValor} tom={ativo.valorRestante > 0 ? "negativo" : "neutro"} />
            <span className={styles.muted}>
              {ativo.valorPago > 0 ? <><Dinheiro valor={ativo.valorPago} /> pagos de <Dinheiro valor={total} /></> : <>total <Dinheiro valor={total} /></>}
              {qtd > 0 && ` · ${qtd} ${qtd === 1 ? "lançamento" : "lançamentos"}`}
            </span>
            {total > 0 && <BarraProgresso fracao={Math.min(1, ativo.valorPago / total)} tom="positivo" rotulo={`${Math.min(100, Math.round((ativo.valorPago / total) * 100))}% pago`} />}
          </>
        )}
        {/* Pagou mais do que as compras que estão no app: o resto é "Cartão (a detalhar)" nos relatórios até a fatura
            entrar (fatura-a-detalhar.md, passo 4). */}
        {!!ativo.valorADetalhar && ativo.valorADetalhar > 0 && (
          <div className={styles.aDetalhar}>
            <div><span className={styles.muted}>Pago</span><Dinheiro valor={ativo.valorPago} /></div>
            <div><span className={styles.muted}>Detalhado</span><Dinheiro valor={total} /></div>
            <div><span className={styles.muted}>Falta detalhar</span><Dinheiro valor={ativo.valorADetalhar} tom="negativo" /></div>
            <Botao onClick={() => navigate("/importar")}>Importar fatura</Botao>
          </div>
        )}
        {!ativo.vazia && ativo.valorRestante > 0 && (
          <RodapeFormulario>
            <Botao variante="primario" onClick={() => navigate(`/cartoes/${cartao.id}/faturas/${ativo.id}/pagar`, { state: { voltarPara: `/cartoes/${cartao.id}` } })}>Pagar fatura</Botao>
          </RodapeFormulario>
        )}
      </Bloco>

      {!ativo.vazia && <LancamentosFatura cartaoId={cartao.id} faturaId={ativo.id} />}
    </>
  )
}

// ─────────────────────────────────────────────────────── lançamentos da fatura

const CHAVE_POR_PAGINA = "v2:porPagina:fatura"
const porPaginaSalvo = (): number => {
  try { const n = Number(localStorage.getItem(CHAVE_POR_PAGINA)); return (TAMANHOS as readonly number[]).includes(n) ? n : 25 } catch { return 25 }
}
const TIPOS: { valor: "" | TipoLancamentoFatura; rotulo: string }[] = [
  { valor: "", rotulo: "Tudo" },
  { valor: "compra", rotulo: "Compras" },
  { valor: "parcela", rotulo: "Parcelas" },
  { valor: "pagamento", rotulo: "Pagamentos" },
]

/** Lançamentos da fatura: busca, tipo e página no servidor (uma fatura pode ter muitos). */
function LancamentosFatura({ cartaoId, faturaId }: { cartaoId: string; faturaId: string }) {
  const [busca, setBusca] = useState("")
  const q = useAtrasado(busca.trim())
  const [tipo, setTipo] = useState<"" | TipoLancamentoFatura>("")
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(porPaginaSalvo)
  const [itens, setItens] = useState<LancamentoFatura[] | null>(null)
  const [total, setTotal] = useState(0)
  const [erro, setErro] = useState(false)

  useEffect(() => { setPagina(1) }, [faturaId, q, tipo])
  useEffect(() => {
    let vivo = true
    setErro(false)
    getLancamentosFatura(cartaoId, faturaId, { q, tipo, page: pagina, pageSize: porPagina })
      .then((r) => { if (vivo) { setItens(r.items); setTotal(r.total) } })
      .catch(() => { if (vivo) { setItens([]); setErro(true) } })
    return () => { vivo = false }
  }, [cartaoId, faturaId, q, tipo, pagina, porPagina])

  // A ordem (dia, criação) já vem do servidor; a lista só agrupa por dia na ordem recebida.
  const linhas = useMemo<ItemDoDia[]>(() => (itens ?? []).map((l) => l.tipo === "pagamento" ? {
    id: l.id, dia: l.data.slice(0, 10), para: `/transacoes/${l.id}`,
    icone: <Banknote size={16} strokeWidth={2} aria-hidden="true" />, tomIcone: "positivo", nome: "Pagamento", sub: l.meioPagamentoDescricao,
    valor: l.valor, tom: "positivo",
  } : {
    id: l.id, dia: l.data.slice(0, 10), para: l.tipo === "compra" ? `/transacoes/${l.id}` : undefined,
    icone: l.descricao.trim().charAt(0).toUpperCase() || "•", nome: l.descricao, sub: l.categoriaDescricao,
    etiqueta: l.tipo === "parcela" ? <Etiqueta>{l.numero}/{l.quantidadeTotal}</Etiqueta> : undefined,
    valor: l.valor, tom: "negativo",
  }), [itens])

  const filtrando = !!q || !!tipo
  return (
    <Bloco semRespiro>
      <div className={styles.toolbar}>
        <Busca valor={busca} onChange={setBusca} placeholder="Buscar na fatura" />
        <div className={styles.filtroTipo}>
          <Selecao tamanho="sm" ariaLabel="Tipo de lançamento" valor={tipo} placeholder="Tudo"
            onChange={(v) => setTipo(v as "" | TipoLancamentoFatura)} opcoes={TIPOS} />
        </div>
      </div>
      {itens === null ? <div className={styles.respiro}><Esqueleto linhas={4} altura={16} /></div>
        : erro ? <p className={styles.vazio}>Não deu pra carregar os lançamentos.</p>
        : itens.length === 0 ? <p className={styles.vazio}>{filtrando ? "Nenhum lançamento com esse filtro." : "Nenhum lançamento nesta fatura."}</p>
        : <ListaPorDia itens={linhas} />}
      {total > 0 && (
        <Paginacao total={total} pagina={pagina} porPagina={porPagina} onPagina={setPagina}
          onPorPagina={(n) => { setPorPagina(n); setPagina(1); try { localStorage.setItem(CHAVE_POR_PAGINA, String(n)) } catch { /* só não lembra */ } }}
          rotulo="lançamentos" rotuloSingular="lançamento" />
      )}
    </Bloco>
  )
}
