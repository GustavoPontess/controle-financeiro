// Bancada de Cartões — C · Extrato do banco, aba Parcelamentos: a faixa na cor do banco com quanto falta
// pagar parcelado no cartão e os parcelamentos em cartões de progresso ("4/10", termina em…).
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Layers, Plus } from "lucide-react"
import { PontesBadge, PontesButton, PontesEmptyState, PontesProgress, PontesSegmented, PontesSkeletonList } from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import CartoesAbas from "../CartoesAbas"
import NovoParcelamentoModal from "../../Parcelamentos/NovoParcelamentoModal"
import { cardGradient } from "../cartoesFormato"
import CartoesLabNav from "./CartoesLabNav"
import { progressoParcelamento, useParcelamentosLab, type FiltroParcelamentos } from "./useParcelamentosLab"
import styles from "./CartoesLab.module.css"

export default function ParcelamentosLabC() {
  const lab = useParcelamentosLab()
  const navigate = useNavigate()
  const credito = lab.cartoes.filter((c) => c.temCredito)
  const [cartaoId, setCartaoId] = useState<string | null>(null)
  const selecionado = credito.find((c) => c.id === cartaoId) ?? credito[0]
  const doCartao = (lab.itens ?? []).filter((p) => p.cartaoCreditoId === selecionado?.id)
  const ativosDoCartao = doCartao.filter((p) => p.ativo)
  const restante = ativosDoCartao.reduce((s, p) => s + p.valorRestante, 0)
  const porMes = ativosDoCartao.reduce((s, p) => s + (p.proximaParcela?.valor ?? 0), 0)

  return (
    <div className={styles.root}>
      <CartoesLabNav atual="c" />
      <div className={styles.header}>
        <CartoesAbas />
        <PontesButton size="sm" iconStart={<Plus size={16} strokeWidth={2.5} />} onClick={() => lab.abrirNovo(selecionado?.id)}>Novo parcelamento</PontesButton>
      </div>

      {credito.length > 1 && (
        <PontesSegmented ariaLabel="Cartão" value={selecionado?.id ?? ""}
          options={credito.map((c) => ({ value: c.id, label: c.nome }))} onChange={setCartaoId} />
      )}

      {selecionado && (
        // Cor do banco (dado do cartão, valor de runtime) — mesma faixa da aba Cartões desta variante.
        <div className={styles.faixa} style={{ background: cardGradient(selecionado.bancoCor, selecionado.bandeira) }}>
          <div className={styles.faixaTopo}>
            <span className={styles.faixaCartao}>{selecionado.nome}{selecionado.ultimosDigitos ? ` •••• ${selecionado.ultimosDigitos}` : ""}</span>
          </div>
          <div className={styles.faixaCorpo}>
            <div>
              <span className={styles.faixaRotulo}>Parcelado a pagar</span>
              <span className={styles.faixaValor}>{formatMoney(restante)}</span>
              <span className={styles.faixaMeta}>{ativosDoCartao.length} {ativosDoCartao.length === 1 ? "parcelamento ativo" : "parcelamentos ativos"}</span>
            </div>
            <div className={styles.faixaDireita}>
              <span className={styles.faixaLimite}>
                <span className={styles.faixaRotulo}>Por mês agora</span>
                <span className={styles.faixaLimiteValor}>{formatMoney(porMes)}</span>
              </span>
            </div>
          </div>
        </div>
      )}

      <PontesSegmented size="sm" ariaLabel="Situação" value={lab.filtro}
        options={[{ value: "ativos", label: "Ativos" }, { value: "encerrados", label: "Encerrados" }, { value: "todos", label: "Todos" }]}
        onChange={(v) => lab.setFiltro(v as FiltroParcelamentos)} />

      {lab.itens === null ? <PontesSkeletonList rows={3} />
        : doCartao.length === 0 ? <PontesEmptyState icon={<Layers size={26} />} title="Nenhum parcelamento neste cartão" />
        : (
          <div className={styles.parcGrade}>
            {doCartao.map((p) => {
              const g = progressoParcelamento(p)
              return (
                <button key={p.id} type="button" className={styles.parcCartao} data-inativo={!p.ativo ? "true" : undefined}
                  onClick={() => navigate(`/credit-cards/parcelamentos/${p.id}`)}>
                  <span className={styles.parcLinha}>
                    <span className={styles.parcNome}>{p.descricao}</span>
                    {!p.ativo && <PontesBadge tone="danger" size="sm">Cancelado</PontesBadge>}
                  </span>
                  <span className={styles.parcContagem}>
                    {p.parcelasPagas}<span className={styles.muted}>/{p.quantidadeParcelas}</span>
                  </span>
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
        )}

      <NovoParcelamentoModal key={lab.novo.key} aberto={lab.novo.aberto} onFechar={lab.fecharNovo}
        onCriado={lab.carregar} cartoes={lab.cartoes} notify={lab.notify} cartaoInicialId={lab.novo.cartaoId} />
    </div>
  )
}
