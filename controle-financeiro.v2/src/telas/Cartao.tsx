// Página de um cartão do v2: faixa de meses em cima (uma fatura por mês, inclusive meses sem lançamento),
// a fatura escolhida embaixo (quanto deve, fecha/vence, pago, lançamentos por dia) e, na coluna da direita,
// limite, o número de parcelamentos e as ações (pagar, editar, excluir). Parcelamentos têm página própria
// (/cartoes/:id/parcelamentos, podem ser muitos) — aqui fica só o número e o "Ver todos".
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Banknote, Pencil, Trash2 } from "lucide-react"
import { deleteCartao, getCartoes } from "../services/cartaoCreditoService"
import { getFaturaDetalhe, getFaturasByCartao } from "../services/faturaService"
import { ParcelamentoService } from "../services/ParcelamentoService"
import { mensagemDeErro } from "../api/cliente"
import type { CartaoCredito } from "../types/CartaoCredito"
import type { Fatura, FaturaDetalhe } from "../types/Fatura"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import BarraProgresso from "../componentes/BarraProgresso"
import Confirmar from "../componentes/Confirmar"
import { Dinheiro } from "../componentes/Dinheiro"
import Etiqueta from "../componentes/Etiqueta"
import FaceCartao from "../componentes/FaceCartao"
import { RodapeFormulario } from "../componentes/Formulario"
import ListaPorDia, { type ItemDoDia } from "../componentes/ListaPorDia"
import { NOME_BANDEIRA, diaMes, estadoDaFatura, indiceMes, indiceMesDeHoje, mesCurto, montarCiclos, rotuloMesFatura, type Ciclo } from "../dominio/fatura"
import styles from "./Cartao.module.css"

export default function Cartao() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [cartao, setCartao] = useState<CartaoCredito | null | undefined>(undefined)
  const [faturas, setFaturas] = useState<Fatura[] | null>(null)
  const [stats, setStats] = useState<{ ativos: number; totalRestante: number } | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const hoje = useMemo(() => new Date(), [])

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

// ─────────────────────────────────────────────────────────────────────────── faturas

function Faturas({ cartao, ciclos, mesHoje, hoje }: { cartao: CartaoCredito; ciclos: Ciclo[] | null; mesHoje: number; hoje: Date }) {
  const navigate = useNavigate()
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const [detalhe, setDetalhe] = useState<FaturaDetalhe | null>(null)
  const [carregando, setCarregando] = useState(false)
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
    setCarregando(true)
    getFaturaDetalhe(cartao.id, ativo.id).then((d) => { if (vivo) setDetalhe(d) }).catch(() => { if (vivo) setDetalhe(null) }).finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [cartao.id, ativo])

  const itens = useMemo<ItemDoDia[]>(() => {
    if (!detalhe) return []
    // `ordem` (criadoEm) desempata dentro do dia; sai antes de ir pra lista.
    type Item = ItemDoDia & { ordem: string }
    const compras: Item[] = detalhe.transacoes.map((t) => ({
      id: t.id, dia: t.data.slice(0, 10), para: `/transacoes/${t.id}`,
      icone: t.descricao.trim().charAt(0).toUpperCase() || "•", nome: t.descricao, sub: t.categoriaDescricao,
      etiqueta: t.parcelas && t.parcelas > 1 ? <Etiqueta>{t.numeroParcela}/{t.parcelas}</Etiqueta> : undefined,
      valor: t.valor, tom: "negativo", ordem: t.criadoEm,
    }))
    const parcelas: Item[] = detalhe.parcelas.map((p) => ({
      id: p.id, dia: p.data.slice(0, 10),
      icone: p.descricao.trim().charAt(0).toUpperCase() || "•", nome: p.descricao, sub: p.categoriaDescricao,
      etiqueta: <Etiqueta>{p.numero}/{p.quantidadeTotal}</Etiqueta>, valor: p.valor, tom: "negativo", ordem: p.criadoEm,
    }))
    const pagamentos: Item[] = detalhe.pagamentos.map((p) => ({
      id: p.id, dia: p.data.slice(0, 10), para: `/transacoes/${p.id}`,
      icone: <Banknote size={16} strokeWidth={2} aria-hidden="true" />, tomIcone: "positivo", nome: "Pagamento", sub: p.meioPagamentoDescricao,
      valor: p.valor, tom: "positivo", ordem: p.criadoEm,
    }))
    return [...compras, ...parcelas, ...pagamentos]
      .sort((a, b) => b.dia.localeCompare(a.dia) || b.ordem.localeCompare(a.ordem))
      .map(({ ordem: _ordem, ...item }) => item)
  }, [detalhe])

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
              <span className={styles.mesValor}>{c.vazia || c.valorTotal === 0 ? "—" : <Dinheiro valor={c.valorTotal} />}</span>
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
            {total > 0 && <BarraProgresso fracao={ativo.valorPago / total} tom="positivo" rotulo={`${Math.round((ativo.valorPago / total) * 100)}% pago`} />}
          </>
        )}
        {!ativo.vazia && ativo.valorRestante > 0 && (
          <RodapeFormulario>
            <Botao variante="primario" onClick={() => navigate(`/cartoes/${cartao.id}/faturas/${ativo.id}/pagar`, { state: { voltarPara: `/cartoes/${cartao.id}` } })}>Pagar fatura</Botao>
          </RodapeFormulario>
        )}
      </Bloco>

      {!ativo.vazia && (
        <Bloco semRespiro>
          {carregando ? <div className={styles.respiro}><Esqueleto linhas={4} altura={16} /></div>
            : itens.length === 0 ? <p className={styles.vazio}>Nenhum lançamento nesta fatura.</p>
            : <ListaPorDia itens={itens} />}
        </Bloco>
      )}
    </>
  )
}
