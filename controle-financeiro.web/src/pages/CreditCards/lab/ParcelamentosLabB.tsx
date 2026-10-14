// Bancada de Cartões — B · Lista lateral, aba Parcelamentos: a mesma coluna de cartões (com quanto falta
// pagar parcelado em cada um) e, do lado, os parcelamentos do cartão escolhido.
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Layers, Plus } from "lucide-react"
import { PontesBadge, PontesButton, PontesCard, PontesEmptyState, PontesProgress, PontesSegmented, PontesSkeletonList } from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import CartoesAbas from "../CartoesAbas"
import NovoParcelamentoModal from "../../Parcelamentos/NovoParcelamentoModal"
import CartoesLabNav from "./CartoesLabNav"
import { IdentidadeCartao } from "./LabPecas"
import { progressoParcelamento, useParcelamentosLab, type FiltroParcelamentos } from "./useParcelamentosLab"
import styles from "./CartoesLab.module.css"

export default function ParcelamentosLabB() {
  const lab = useParcelamentosLab()
  const navigate = useNavigate()
  const credito = lab.cartoes.filter((c) => c.temCredito)
  const [cartaoId, setCartaoId] = useState<string | null>(null)
  const selecionado = credito.find((c) => c.id === cartaoId) ?? credito[0]
  const doCartao = (lab.itens ?? []).filter((p) => p.cartaoCreditoId === selecionado?.id)
  const restanteDe = (id: string) => (lab.itens ?? []).filter((p) => p.cartaoCreditoId === id && p.ativo).reduce((s, p) => s + p.valorRestante, 0)

  return (
    <div className={styles.root}>
      <CartoesLabNav atual="b" />
      <div className={styles.header}>
        <CartoesAbas />
        <PontesButton size="sm" iconStart={<Plus size={16} strokeWidth={2.5} />} onClick={() => lab.abrirNovo(selecionado?.id)}>Novo parcelamento</PontesButton>
      </div>

      <div className={styles.mestreDetalhe}>
        <aside className={styles.listaCartoes} aria-label="Cartões">
          {credito.map((c) => (
            <button key={c.id} type="button" className={styles.itemCartao}
              data-sel={c.id === selecionado?.id ? "true" : undefined} onClick={() => setCartaoId(c.id)}>
              <IdentidadeCartao cartao={c} />
              <span className={styles.itemCartaoLinha}>
                <span className={styles.muted}>parcelado a pagar</span>
                <span className={styles.valorLinha}>{formatMoney(restanteDe(c.id))}</span>
              </span>
            </button>
          ))}
        </aside>

        <PontesCard padding={0} radius={16}>
          <div className={styles.detalheTopo}>
            {selecionado ? <IdentidadeCartao cartao={selecionado} /> : <span />}
            <PontesSegmented size="sm" ariaLabel="Situação" value={lab.filtro}
              options={[{ value: "ativos", label: "Ativos" }, { value: "encerrados", label: "Encerrados" }, { value: "todos", label: "Todos" }]}
              onChange={(v) => lab.setFiltro(v as FiltroParcelamentos)} />
          </div>
          {lab.itens === null ? <div className={styles.estado}><PontesSkeletonList rows={4} /></div>
            : doCartao.length === 0 ? (
              <div className={styles.estado}><PontesEmptyState icon={<Layers size={26} />} title="Nenhum parcelamento neste cartão" /></div>
            ) : (
              <div className={styles.porDia}>
                {doCartao.map((p) => {
                  const g = progressoParcelamento(p)
                  return (
                    <div key={p.id} className={styles.parcLinhaLista} data-clicavel="true"
                      onClick={() => navigate(`/credit-cards/parcelamentos/${p.id}`)}>
                      <span className={styles.itemDiaTexto}>
                        <span className={styles.itemDiaNome}>
                          {p.descricao} {!p.ativo && <PontesBadge tone="danger" size="sm">Cancelado</PontesBadge>}
                        </span>
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
            )}
        </PontesCard>
      </div>

      <NovoParcelamentoModal key={lab.novo.key} aberto={lab.novo.aberto} onFechar={lab.fecharNovo}
        onCriado={lab.carregar} cartoes={lab.cartoes} notify={lab.notify} cartaoInicialId={lab.novo.cartaoId} />
    </div>
  )
}
