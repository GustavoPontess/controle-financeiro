// Bancada de layout de Cartões — seções que penduram no cartão (parcelamentos, assinaturas, dados do
// cartão). Cartão, fatura, parcelamento e assinatura são um módulo só: cada variante arruma essas peças
// do seu jeito.
import { useNavigate } from "react-router-dom"
import { Layers, Pencil, Repeat, Trash2 } from "lucide-react"
import {
  PontesBadge, PontesButton, PontesCelulaIdentidade, PontesEmptyState, PontesProgress, PontesSegmented,
  PontesSkeletonList, PontesTabela,
} from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import type { CartaoCredito } from "../../../types/CartaoCredito"
import type { Parcelamento } from "../../../types/Parcelamento"
import type { Recorrente } from "../../../types/Recorrente"
import type { CartoesLogic } from "../useCartoesLogic"
import { BANDEIRA_OPTIONS } from "../cartoesFormato"
import { progressoParcelamento, type FiltroParcelamentos } from "./useParcelamentosLab"
import styles from "./CartoesLab.module.css"

const FILTROS = [{ value: "ativos", label: "Ativos" }, { value: "encerrados", label: "Encerrados" }, { value: "todos", label: "Todos" }]

/** Seletor de situação dos parcelamentos (o filtro vai pro servidor). */
export function FiltroSituacao({ filtro, setFiltro }: { filtro: FiltroParcelamentos; setFiltro: (f: FiltroParcelamentos) => void }) {
  return <PontesSegmented size="sm" ariaLabel="Situação" value={filtro} options={FILTROS} onChange={(v) => setFiltro(v as FiltroParcelamentos)} />
}

function useAbrirParcelamento() {
  const navigate = useNavigate()
  return (p: Parcelamento) => navigate(`/credit-cards/parcelamentos/${p.id}`)
}

/** Parcelamentos em tabela (mesmo componente de Transações). */
export function ParcelamentosTabela({ itens, filtro, setFiltro }: {
  itens: Parcelamento[] | null; filtro: FiltroParcelamentos; setFiltro: (f: FiltroParcelamentos) => void
}) {
  const abrir = useAbrirParcelamento()
  return (
    <PontesTabela<Parcelamento>
      id="cartoes-lab-parcelamentos"
      titulo="Parcelamentos"
      filtros={[{ value: filtro, ariaLabel: "Situação", options: FILTROS, onChange: (v) => setFiltro(v as FiltroParcelamentos) }]}
      carregando={itens === null}
      itens={itens ?? []}
      chave={(p) => p.id}
      onLinhaClick={abrir}
      vazio={{ icone: <Layers size={28} />, titulo: "Nenhum parcelamento neste cartão" }}
      colunas={[
        {
          key: "descricao", header: "Compra", render: (p) => (
            <PontesCelulaIdentidade tom="saida" icone={<Layers size={14} strokeWidth={2.5} />} nome={p.descricao}
              sub={!p.ativo ? <PontesBadge tone="danger" size="sm">Cancelado</PontesBadge> : undefined} />
          ),
        },
        {
          key: "progresso", header: "Progresso", render: (p) => (
            <span className={styles.progressoCelula}>
              <span className={styles.valorLinha}>{p.parcelasPagas}/{p.quantidadeParcelas}</span>
              <PontesProgress value={progressoParcelamento(p).pct} showValue={false} height={4} />
            </span>
          ),
        },
        { key: "parcela", header: "Parcela", numerica: true, render: (p) => (p.proximaParcela ? formatMoney(p.proximaParcela.valor) : "—") },
        { key: "termina", header: "Termina", render: (p) => progressoParcelamento(p).termina ?? "—" },
        { key: "falta", header: "Falta", numerica: true, render: (p) => <span className={styles.valorLinha}>{formatMoney(p.valorRestante)}</span> },
      ]}
    />
  )
}

/** Parcelamentos em lista (linha com barra de progresso). */
export function ParcelamentosLista({ itens }: { itens: Parcelamento[] | null }) {
  const abrir = useAbrirParcelamento()
  if (itens === null) return <div className={styles.estado}><PontesSkeletonList rows={3} /></div>
  if (itens.length === 0) return <div className={styles.estado}><PontesEmptyState icon={<Layers size={26} />} title="Nenhum parcelamento neste cartão" /></div>
  return (
    <div className={styles.porDia}>
      {itens.map((p) => {
        const g = progressoParcelamento(p)
        return (
          <div key={p.id} className={styles.parcLinhaLista} onClick={() => abrir(p)}>
            <span className={styles.itemDiaTexto}>
              <span className={styles.itemDiaNome}>{p.descricao} {!p.ativo && <PontesBadge tone="danger" size="sm">Cancelado</PontesBadge>}</span>
              <PontesProgress value={g.pct} showValue={false} height={4} />
              <span className={styles.muted}>
                {p.parcelasPagas} de {p.quantidadeParcelas} pagas{g.proxima ? ` · próxima em ${g.proxima}` : ""}{g.termina ? ` · termina em ${g.termina}` : ""}
              </span>
            </span>
            <span className={styles.parcValores}>
              <span className={styles.itemDiaValor}>{p.proximaParcela ? formatMoney(p.proximaParcela.valor) : "—"}</span>
              <span className={styles.muted}>falta {formatMoney(p.valorRestante)}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** Parcelamentos em blocos de progresso ("4/10", termina em…). */
export function ParcelamentosBlocos({ itens }: { itens: Parcelamento[] | null }) {
  const abrir = useAbrirParcelamento()
  if (itens === null) return <PontesSkeletonList rows={2} />
  if (itens.length === 0) return <span className={styles.muted}>Nenhum parcelamento neste cartão.</span>
  return (
    <div className={styles.parcGrade}>
      {itens.map((p) => {
        const g = progressoParcelamento(p)
        return (
          <button key={p.id} type="button" className={styles.parcCartao} data-inativo={!p.ativo ? "true" : undefined} onClick={() => abrir(p)}>
            <span className={styles.parcLinha}>
              <span className={styles.parcNome}>{p.descricao}</span>
              {!p.ativo && <PontesBadge tone="danger" size="sm">Cancelado</PontesBadge>}
            </span>
            <span className={styles.parcContagem}>{p.parcelasPagas}<span className={styles.muted}>/{p.quantidadeParcelas}</span></span>
            <PontesProgress value={g.pct} showValue={false} height={6} />
            <span className={styles.parcLinha}>
              <span className={styles.muted}>{p.proximaParcela ? `${formatMoney(p.proximaParcela.valor)} por mês` : "quitado"}</span>
              <span className={styles.muted}>{g.termina ? `termina em ${g.termina}` : ""}</span>
            </span>
            <span className={styles.parcLinha}>
              <span className={styles.muted}>falta</span>
              <span className={styles.valorLinha}>{formatMoney(p.valorRestante)}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Assinaturas (contas fixas) cobradas no cartão. */
export function AssinaturasLista({ itens, tituloVazio = "Nenhuma assinatura neste cartão" }: { itens: Recorrente[]; tituloVazio?: string }) {
  const navigate = useNavigate()
  if (itens.length === 0) {
    return (
      <div className={styles.estado}>
        <PontesEmptyState icon={<Repeat size={26} />} title={tituloVazio}
          actions={<PontesButton size="sm" variant="outline" onClick={() => navigate("/assinaturas")}>Ir pra Contas fixas</PontesButton>} />
      </div>
    )
  }
  return (
    <div className={styles.porDia}>
      {itens.map((r) => (
        <div key={r.id} className={styles.parcLinhaLista} onClick={() => navigate("/assinaturas")}>
          <span className={styles.itemDiaTexto}>
            <span className={styles.itemDiaNome}>{r.descricao} {r.situacao === "pausada" && <PontesBadge tone="neutral" size="sm">Pausada</PontesBadge>}</span>
            <span className={styles.muted}>
              {r.frequenciaDescricao.toLowerCase()} · dia {r.dia}{r.proximaCobranca ? ` · próxima ${r.proximaCobranca.slice(8, 10)}/${r.proximaCobranca.slice(5, 7)}` : ""}
            </span>
          </span>
          <span className={styles.itemDiaValor}>{formatMoney(r.valor)}</span>
        </div>
      ))}
    </div>
  )
}

/** Dados do cartão + editar/remover (os modais da tela real). */
export function DetalhesCartao({ logic, cartao }: { logic: CartoesLogic; cartao: CartaoCredito }) {
  const modalidade = cartao.ehPrePago ? "Pré-pago" : cartao.temCredito && cartao.temDebito ? "Crédito e débito" : cartao.temCredito ? "Crédito" : "Débito"
  const linhas: [string, string][] = [
    ["Banco", cartao.bancoNome ?? "—"],
    ["Bandeira", BANDEIRA_OPTIONS.find((b) => b.value === cartao.bandeira)?.label ?? "—"],
    ["Final", cartao.ultimosDigitos ?? "—"],
    ["Modalidade", modalidade],
    ["Limite", cartao.limite ? formatMoney(cartao.limite) : "—"],
    ["Fecha", cartao.diaFechamento ? `dia ${cartao.diaFechamento}` : "—"],
    ["Vence", cartao.diaVencimento ? `dia ${cartao.diaVencimento}` : "—"],
    ["Conta que paga", cartao.contaNome ?? "—"],
  ]
  return (
    <div className={styles.detalhes}>
      <dl className={styles.detalhesGrade}>
        {linhas.map(([k, v]) => (
          <div key={k} className={styles.detalhesItem}><dt className={styles.rotulo}>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      <div className={styles.detalhesAcoes}>
        <PontesButton size="sm" variant="outline" iconStart={<Pencil size={16} strokeWidth={2.5} />} onClick={() => logic.openEdit(cartao)}>Editar cartão</PontesButton>
        <PontesButton size="sm" variant="danger-outline" iconStart={<Trash2 size={16} strokeWidth={2.5} />} onClick={() => logic.pedirRemocao(cartao.id)}>Remover</PontesButton>
      </div>
    </div>
  )
}
