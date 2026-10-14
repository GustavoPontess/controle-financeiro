// Bancada de layout de Cartões: peças que as variantes A/B/C combinam. Tudo ligado ao useCartoesLogic
// (mesmos serviços e modais da tela real) — as bancadas funcionam de verdade, com o dado real.
import { useEffect, useRef } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { Banknote, ChevronLeft, ChevronRight, Layers, Pencil, ReceiptText, Trash2, Undo2 } from "lucide-react"
import {
  PontesBadge, PontesBankBadge, PontesButton, PontesEmptyState, PontesProgress, PontesRowActions,
  PontesSkeletonList, PontesTabela, PontesCelulaIdentidade,
} from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import type { CartaoCredito } from "../../../types/CartaoCredito"
import BandeiraMark from "../BandeiraMark"
import { STATUS, formatDate, statusKey } from "../cartoesFormato"
import { rotuloMesFatura, type FaturaView } from "../ciclosFatura"
import type { CartoesLogic } from "../useCartoesLogic"
import { diaCurto, diaPorExtenso, linhasDaFatura, mesCurto, type LinhaFatura } from "./faturaLinhas"
import styles from "./CartoesLab.module.css"


/** Ações do cartão (⋮): editar e remover — os mesmos modais da tela real. */
export function AcoesCartao({ logic, cartao }: { logic: CartoesLogic; cartao: CartaoCredito }) {
  return (
    <PontesRowActions ariaLabel={`Ações do cartão ${cartao.nome}`} actions={[
      { key: "editar", label: "Editar cartão", icon: <Pencil size={16} strokeWidth={2.5} />, onClick: () => logic.openEdit(cartao) },
      { key: "remover", label: "Remover cartão", icon: <Trash2 size={16} strokeWidth={2.5} />, danger: true, onClick: () => logic.pedirRemocao(cartao.id) },
    ]} />
  )
}

/** Identidade compacta do cartão: logo do banco + nome + final + bandeira. */
export function IdentidadeCartao({ cartao, sub }: { cartao: CartaoCredito; sub?: string }) {
  return (
    <span className={styles.ident}>
      <PontesBankBadge name={cartao.bancoNome ?? cartao.nome} logoUrl={cartao.bancoLogoUrl} cor={cartao.bancoCor} size={32} />
      <span className={styles.identTexto}>
        <span className={styles.identNome}>{cartao.nome}</span>
        <span className={styles.identSub}>
          {sub ?? (cartao.ultimosDigitos ? `final ${cartao.ultimosDigitos}` : cartao.bancoNome ?? "")}
        </span>
      </span>
      <span className={styles.identBandeira}><BandeiraMark bandeira={cartao.bandeira} width={30} genericColor="var(--pontes-text-muted)" /></span>
    </span>
  )
}

/** Valor da fatura selecionada + situação + vencimento + Pagar. */
export function ResumoFatura({ logic, f }: { logic: CartoesLogic; f: FaturaView }) {
  const { now, cartaoAtivo } = logic
  const st = STATUS[statusKey(f, now)]
  const aberta = f.valorRestante > 0
  const ehFutura = !f.prevista && !f.vazia && new Date(f.dataInicio).getTime() > now
  const ehAtual = logic.idxSelecionado === logic.atualIdx
  return (
    <div className={styles.resumo}>
      <span className={styles.rotulo}>
        Fatura de {rotuloMesFatura(f.dataFechamento).toLowerCase()}{ehAtual ? " · atual" : f.prevista ? " · prevista" : ""}
      </span>
      <div className={styles.resumoLinha}>
        <span className={styles.valorGrande}>{formatMoney(aberta ? f.valorRestante : f.valorTotal)}</span>
        {aberta && !f.prevista && !ehFutura && cartaoAtivo && (
          <PontesButton size="sm" iconStart={<Banknote size={16} strokeWidth={2.5} />}
            onClick={() => logic.openPagar(f.id, cartaoAtivo.id, f.valorRestante, cartaoAtivo.contaId)}>
            Pagar
          </PontesButton>
        )}
      </div>
      {!f.vazia && (
        <div className={styles.resumoMeta}>
          {f.prevista
            ? <PontesBadge tone="neutral" size="sm">Prevista</PontesBadge>
            : <PontesBadge tone={st.tone} size="sm">{st.label}</PontesBadge>}
          {!f.prevista && f.vencida && <PontesBadge tone="danger" size="sm">Vencida</PontesBadge>}
          <span className={styles.muted}>fecha {formatDate(f.dataFechamento)} · {f.vencida ? "venceu" : "vence"} {formatDate(f.dataVencimento)}</span>
        </div>
      )}
      {f.valorPago > 0 && aberta && (
        <div className={styles.pagoParcial}>
          <PontesProgress value={Math.min(100, (f.valorPago / f.valorTotal) * 100)} showValue={false} height={6} color="var(--pontes-success)" />
          <span className={styles.muted}>pago {formatMoney(f.valorPago)} de {formatMoney(f.valorTotal)}</span>
        </div>
      )}
    </div>
  )
}

/** Limite: disponível em destaque + barra do usado + "de R$ X". */
export function ResumoLimite({ cartao }: { cartao: CartaoCredito }) {
  if (!cartao.temCredito || !cartao.limite) return null
  const usado = cartao.limiteUsado ?? 0
  const pct = Math.min((usado / cartao.limite) * 100, 100)
  return (
    <div className={styles.resumo}>
      <span className={styles.rotulo}>Limite disponível</span>
      <span className={styles.valorMedio} data-tom="entrada">{formatMoney(cartao.limiteDisponivel ?? 0)}</span>
      <PontesProgress value={pct} showValue={false} height={6} color={pct > 80 ? "var(--pontes-danger)" : "var(--pontes-primary)"} />
      <div className={styles.limiteRodape}>
        <span>usado {formatMoney(usado)}</span>
        <span>de {formatMoney(cartao.limite)}</span>
      </div>
    </div>
  )
}

/** Linha de meses (mais antigo → mais novo) com o valor de cada fatura; clicar abre o mês. */
export function LinhaMeses({ logic }: { logic: CartoesLogic }) {
  const { ciclos, idxSelecionado, atualIdx, now } = logic
  const selRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => { selRef.current?.scrollIntoView({ block: "nearest", inline: "center" }) }, [idxSelecionado, ciclos.length])
  if (ciclos.length === 0) return null
  const ordem = ciclos.map((f, i) => ({ f, i })).reverse()
  return (
    <div className={styles.meses} role="tablist" aria-label="Faturas por mês">
      {ordem.map(({ f, i }) => {
        const sel = i === idxSelecionado
        const situacao = f.vazia ? "vazia" : f.prevista ? "prevista" : f.vencida ? "vencida" : ["", "aberta", "fechada", "paga", "futura"][statusKey(f, now)]
        return (
          <button key={f.id} ref={sel ? selRef : undefined} type="button" role="tab" aria-selected={sel}
            className={styles.mes} data-sel={sel ? "true" : undefined} data-situacao={situacao}
            onClick={() => logic.irParaFatura(i)}>
            <span className={styles.mesNome}>{mesCurto(f.dataFechamento)}{i === atualIdx ? " · atual" : ""}</span>
            <span className={styles.mesValor}>{f.vazia ? "—" : formatMoney(f.valorTotal)}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Navegação ‹ mês › com o nome e o período (variante B). */
export function NavMes({ logic }: { logic: CartoesLogic }) {
  const f: FaturaView | undefined = logic.ciclos[logic.idxSelecionado]
  if (!f) return null
  const { idxSelecionado: idx, ultimoIdx } = logic
  return (
    <div className={styles.navMes}>
      <PontesButton size="sm" variant="ghost" aria-label="Mês anterior" disabled={idx >= ultimoIdx}
        onClick={() => logic.irParaFatura(idx + 1)}><ChevronLeft size={16} strokeWidth={2.5} /></PontesButton>
      <span className={styles.navMesNome}>{rotuloMesFatura(f.dataFechamento)}</span>
      <PontesButton size="sm" variant="ghost" aria-label="Próximo mês" disabled={idx <= 0}
        onClick={() => logic.irParaFatura(idx - 1)}><ChevronRight size={16} strokeWidth={2.5} /></PontesButton>
      {idx !== logic.atualIdx && (
        <PontesButton size="sm" variant="outline" onClick={() => logic.irParaFatura(logic.atualIdx)}>Hoje</PontesButton>
      )}
    </div>
  )
}

/** Abre o lançamento: compra → tela da transação (volta pra cá); parcela → o parcelamento. */
function useAbrirLinha() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return (l: LinhaFatura) => {
    if (l.tipo === "compra" && !l.prevista) navigate(`/transactions/${l.id}`, { state: { voltarPara: pathname } })
    else if (l.tipo === "parcela") navigate(`/credit-cards/parcelamentos/${l.parcelamentoId}`)
  }
}

function SeloParcela({ l }: { l: LinhaFatura }) {
  if (l.tipo !== "parcela") return null
  return <span className={styles.seloParcela}><Layers size={12} strokeWidth={2.5} aria-hidden="true" />{l.numero}/{l.total}</span>
}

function useLinhas(logic: CartoesLogic, f: FaturaView) {
  return linhasDaFatura(f, logic.faturaDetalhes[f.id])
}

/** Variante A: a fatura como tabela (PontesTabela — o mesmo componente de Transações). */
export function FaturaTabela({ logic, f }: { logic: CartoesLogic; f: FaturaView }) {
  const linhas = useLinhas(logic, f)
  const abrir = useAbrirLinha()
  return (
    <PontesTabela<LinhaFatura>
      id="cartoes-lab-fatura"
      titulo="Lançamentos"
      carregando={linhas === null}
      itens={linhas ?? []}
      chave={(l) => `${l.tipo}-${l.id}`}
      onLinhaClick={abrir}
      vazio={{ icone: <ReceiptText size={28} />, titulo: f.vazia ? "Sem lançamentos neste mês" : "Nenhum lançamento nesta fatura" }}
      colunas={[
        { key: "dia", header: "Data", render: (l) => diaCurto(l.dia) },
        {
          key: "descricao", header: "Descrição", render: (l) => (
            <PontesCelulaIdentidade
              tom={l.tipo === "pagamento" ? "entrada" : "saida"}
              icone={l.tipo === "pagamento" ? <Banknote size={14} strokeWidth={2.5} /> : l.tipo === "parcela" ? <Layers size={14} strokeWidth={2.5} /> : <ReceiptText size={14} strokeWidth={2.5} />}
              nome={l.descricao}
              sub={l.tipo === "parcela" ? `parcela ${l.numero}/${l.total} · compra ${diaCurto(l.dataCompra)}` : l.tipo === "compra" && l.prevista ? "assinatura prevista" : undefined}
            />
          ),
        },
        { key: "categoria", header: "Categoria", render: (l) => (l.tipo !== "pagamento" && l.categoria) || "—" },
        { key: "valor", header: "Valor", numerica: true, render: (l) => <span data-tom={l.tipo === "pagamento" ? "entrada" : undefined} className={styles.valorLinha}>{formatMoney(l.valor)}</span> },
      ]}
      renderAcoes={(l) => l.tipo === "pagamento" ? (
        <PontesRowActions actions={[{ key: "estornar", label: "Estornar pagamento", icon: <Undo2 size={16} strokeWidth={2.5} />,
          onClick: () => logic.pedirEstorno({ id: l.id, valor: l.valor, cartaoId: f.cartaoCreditoId, faturaId: f.id }) }]} />
      ) : null}
    />
  )
}

/** Variantes B e C: a fatura agrupada por dia, como extrato de banco. */
export function FaturaPorDia({ logic, f }: { logic: CartoesLogic; f: FaturaView }) {
  const linhas = useLinhas(logic, f)
  const abrir = useAbrirLinha()
  if (linhas === null) return <div className={styles.estado}><PontesSkeletonList rows={5} /></div>
  if (linhas.length === 0) {
    return <div className={styles.estado}><PontesEmptyState icon={<ReceiptText size={26} />} title={f.vazia ? "Sem lançamentos neste mês" : "Nenhum lançamento nesta fatura"} /></div>
  }
  const dias: { dia: string; itens: LinhaFatura[] }[] = []
  for (const l of linhas) {
    const g = dias[dias.length - 1]
    if (g && g.dia === l.dia) g.itens.push(l)
    else dias.push({ dia: l.dia, itens: [l] })
  }
  return (
    <div className={styles.porDia}>
      {dias.map((g) => (
        <section key={g.dia} className={styles.grupoDia}>
          <h3 className={styles.grupoDiaTitulo}>{diaPorExtenso(g.dia)}</h3>
          {g.itens.map((l) => (
            <div key={`${l.tipo}-${l.id}`} className={styles.itemDia} data-tipo={l.tipo}
              data-clicavel={(l.tipo === "compra" && !l.prevista) || l.tipo === "parcela" ? "true" : undefined}
              onClick={() => abrir(l)}>
              <span className={styles.itemDiaTexto}>
                <span className={styles.itemDiaNome}>{l.descricao} <SeloParcela l={l} /></span>
                {l.tipo !== "pagamento" && l.categoria && <span className={styles.muted}>{l.categoria}</span>}
              </span>
              <span className={styles.itemDiaValor} data-tom={l.tipo === "pagamento" ? "entrada" : undefined}>{formatMoney(l.valor)}</span>
              {l.tipo === "pagamento" && (
                <span onClick={(e) => e.stopPropagation()}>
                  <PontesButton size="sm" variant="ghost"
                    onClick={() => logic.pedirEstorno({ id: l.id, valor: l.valor, cartaoId: f.cartaoCreditoId, faturaId: f.id })}>
                    Estornar
                  </PontesButton>
                </span>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}

/** Painel inteiro carregando (cartão escolhido, faturas ainda vindo). */
export function CarregandoFatura() {
  return <div className={styles.estado}><PontesSkeletonList rows={4} /></div>
}

/** Sem cartão nenhum. */
export function SemCartoes({ logic }: { logic: CartoesLogic }) {
  return (
    <PontesEmptyState icon={<ReceiptText size={28} />} title="Nenhum cartão cadastrado"
      actions={<PontesButton size="sm" onClick={logic.openCreate}>Novo cartão</PontesButton>} />
  )
}

/** Link "ver todos os parcelamentos" pra aba de Parcelamentos. */
export function LinkParcelamentos() {
  return <Link to="/credit-cards/parcelamentos" className={styles.link}>Ver todos</Link>
}
