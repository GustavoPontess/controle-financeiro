import React, { useCallback, useEffect, useState } from "react"
import { formatMoney } from "@/utils/money"
import { useNavigate, useOutletContext } from "react-router-dom"
import { Plus, ChevronRight, Layers } from "lucide-react"
import {
  PontesButton, PontesCard, PontesBadge, PontesStatCard,
  PontesEmptyState, PontesTablePagination, PONTES_TABLE_PAGE_SIZE_DEFAULT,
} from "@/components/pontes"
import { ParcelamentoService } from "../../services/ParcelamentoService"
import { getCartoes } from "../../services/cartaoCreditoService"
import { TipoParcelamento } from "../../types/Parcelamento"
import type { Parcelamento } from "../../types/Parcelamento"
import type { CartaoCredito } from "../../types/CartaoCredito"
import { rotuloMesFatura } from "../CreditCards/ciclosFatura"
import styles from "./ParcelamentosPage.module.css"
import CartoesAbas from "../CreditCards/CartoesAbas"
import CartoesLabNav from "../CreditCards/lab/CartoesLabNav"
import NovoParcelamentoModal from "./NovoParcelamentoModal"

const tiposLabel: Record<number, string> = {
  0: "Compra Parcelada",
  1: "PIX Crédito",
  2: "Recorrente",
}

type Notification = { open: boolean; message: string; severity: "success" | "error" | "warning" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

export default function ParcelamentosPage() {
  const navigate = useNavigate()
  const { notify } = useOutletContext<OutletContextType>()
  const [parcelamentos, setParcelamentos] = useState<Parcelamento[]>([])
  // KPIs exatos via /parcelamentos/stats (#179).
  const [stats, setStats] = useState({ ativos: 0, totalRestante: 0, qtdTotal: 0 })
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(PONTES_TABLE_PAGE_SIZE_DEFAULT)
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([])
  // "Novo parcelamento": o modal remonta a cada abertura (form zerado + Idempotency-Key nova).
  const [novoAberto, setNovoAberto] = useState(false)
  const [novoKey, setNovoKey] = useState(0)
  const abrirNovo = () => { setNovoKey((k) => k + 1); setNovoAberto(true) }

  const loadData = useCallback(async () => {
    try {
      const [pageResult, statsResult, c] = await Promise.all([
        ParcelamentoService.listarPaginado(page, pageSize),
        ParcelamentoService.obterStats(),
        getCartoes(),
      ])
      setParcelamentos(pageResult.items)
      setTotal(pageResult.total)
      setStats(statsResult)
      setCartoes(c)
    } catch {
      notify({ open: true, message: "Erro ao carregar parcelamentos", severity: "error" })
    }
  }, [notify, page, pageSize])

  useEffect(() => { void loadData() }, [loadData])

  const { ativos, totalRestante } = stats

  return (
    <div className={styles.root}>
      {/* Passador TEMPORÁRIO da bancada de layout de Cartões (tela atual → A → B → C) — sai quando escolher a vencedora. */}
      <CartoesLabNav atual="atual" />
      <div className={styles.header}>
        {/* Parcelamento mora dentro de Cartões — mesmas abas da tela de cartões. */}
        <CartoesAbas />
        <PontesButton size="sm" iconStart={<Plus size={16} strokeWidth={2.5} />} onClick={abrirNovo}>
          Novo Parcelamento
        </PontesButton>
      </div>

      <div className={styles.statsGrid}>
        <PontesStatCard label="Ativos" value={String(ativos)} hint="parcelamentos em andamento" />
        <PontesStatCard label="A pagar" value={formatMoney(totalRestante)} hint="soma dos restantes" tone="danger" />
      </div>

      <PontesCard padding={0} radius={16}>
        <div className={styles.listHead}>
          <span className={styles.listHeadTitle}>Seus parcelamentos</span>
          <span className={styles.listHeadMeta}>{total} {total === 1 ? "registrado" : "registrados"}</span>
        </div>

        {total === 0 ? (
          <div className={styles.emptyWrap}>
            <PontesEmptyState
              icon={<Layers size={28} />}
              title="Nenhum parcelamento cadastrado"
              description="Crie um novo parcelamento pra começar a acompanhar suas compras parceladas."
            />
          </div>
        ) : (
          <ul className={styles.list}>
            {parcelamentos.map((p) => {
              const pct = (p.parcelasPagas / p.quantidadeParcelas) * 100
              return (
                <li key={p.id} className={styles.item} data-inactive={!p.ativo ? "true" : undefined}>
                  <div className={styles.itemMain}>
                    <div className={styles.itemHead}>
                      <span className={styles.itemDesc}>{p.descricao}</span>
                      {/* Badge só pra exceção — "Compra Parcelada" é o padrão e já é óbvio na página. */}
                      {p.tipo !== TipoParcelamento.CompraParcelada && (
                        <PontesBadge tone="neutral" size="sm">{tiposLabel[p.tipo] ?? "—"}</PontesBadge>
                      )}
                      {/* O cinza sozinho não dizia nada — cancelado precisa estar escrito. */}
                      {!p.ativo && <PontesBadge tone="danger" size="sm">Cancelado</PontesBadge>}
                      <span className={styles.itemPills}>{p.quantidadeParcelas}× · {p.parcelasPagas}/{p.quantidadeParcelas} pago</span>
                      <span className={styles.itemAmount}>{formatMoney(p.valorOriginal)}</span>
                    </div>
                    <div className={styles.progressWrap}>
                      <div className={styles.bar}>
                        <div className={styles.barFill} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={styles.progressPct}>{pct.toFixed(0)}%</span>
                    </div>
                    <div className={styles.itemFoot}>
                      {p.proximaParcela && (
                        <span className={styles.footItem}>
                          <span className={styles.metricLabel}>Próxima</span>
                          Fatura {rotuloMesFatura(p.proximaParcela.faturaMesReferencia)} · <strong>{formatMoney(p.proximaParcela.valor)}</strong>
                        </span>
                      )}
                      <span className={styles.footItem}>
                        <span className={styles.metricLabel}>Restante</span>
                        <strong>{formatMoney(p.valorRestante)}</strong>
                      </span>
                    </div>
                  </div>

                  <div className={styles.itemActions}>
                    <PontesButton variant="outline" size="sm" iconEnd={<ChevronRight size={14} />}
                      onClick={() => navigate(`/credit-cards/parcelamentos/${p.id}`)}>
                      Detalhes
                    </PontesButton>
                    {/* Cancelar só no detalhe: lá a pessoa vê as parcelas (pagas × pendentes) antes de
                        decidir — a lixeira na lista cancelava às cegas, a um clique do "Detalhes". */}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {total > 0 && (
          <PontesTablePagination
            total={total} page={page} pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
            itemLabel="parcelamentos" itemLabelSingular="parcelamento"
          />
        )}
      </PontesCard>

      <NovoParcelamentoModal key={novoKey} aberto={novoAberto} onFechar={() => setNovoAberto(false)}
        onCriado={loadData} cartoes={cartoes} notify={notify} />
    </div>
  )
}
