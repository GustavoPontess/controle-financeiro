// Bancada de Cartões — A · Painel, aba Parcelamentos: KPIs + tabela (PontesTabela, o mesmo componente de
// Transações) com progresso, próxima fatura, quando termina e quanto falta.
import { useNavigate } from "react-router-dom"
import { Layers, Plus } from "lucide-react"
import { PontesButton, PontesCelulaIdentidade, PontesProgress, PontesStatCard, PontesTabela, PontesBadge } from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import type { Parcelamento } from "../../../types/Parcelamento"
import CartoesAbas from "../CartoesAbas"
import NovoParcelamentoModal from "../../Parcelamentos/NovoParcelamentoModal"
import CartoesLabNav from "./CartoesLabNav"
import { progressoParcelamento, useParcelamentosLab, type FiltroParcelamentos } from "./useParcelamentosLab"
import styles from "./CartoesLab.module.css"

export default function ParcelamentosLabA() {
  const lab = useParcelamentosLab()
  const navigate = useNavigate()

  return (
    <div className={styles.root}>
      <CartoesLabNav atual="a" />
      <div className={styles.header}>
        <CartoesAbas />
        <PontesButton size="sm" iconStart={<Plus size={16} strokeWidth={2.5} />} onClick={() => lab.abrirNovo()}>Novo parcelamento</PontesButton>
      </div>

      <PontesTabela<Parcelamento>
        id="cartoes-lab-parcelamentos"
        titulo="Parcelamentos"
        resumo={(
          <div className={styles.duasColunas}>
            <PontesStatCard label="Ativos" value={String(lab.stats.ativos)} />
            <PontesStatCard label="A pagar" value={formatMoney(lab.stats.totalRestante)} tone="danger" />
          </div>
        )}
        filtros={[{
          value: lab.filtro, ariaLabel: "Situação",
          options: [{ value: "ativos", label: "Ativos" }, { value: "encerrados", label: "Encerrados" }, { value: "todos", label: "Todos" }],
          onChange: (v) => lab.setFiltro(v as FiltroParcelamentos),
        }]}
        carregando={lab.itens === null}
        itens={lab.itens ?? []}
        chave={(p) => p.id}
        onLinhaClick={(p) => navigate(`/credit-cards/parcelamentos/${p.id}`)}
        vazio={{ icone: <Layers size={28} />, titulo: lab.filtro === "ativos" ? "Nenhum parcelamento ativo" : "Nenhum parcelamento" }}
        colunas={[
          {
            key: "descricao", header: "Compra", render: (p) => (
              <PontesCelulaIdentidade tom="saida" icone={<Layers size={14} strokeWidth={2.5} />} nome={p.descricao}
                sub={<>{p.cartaoCreditoNome}{!p.ativo && <> · <PontesBadge tone="danger" size="sm">Cancelado</PontesBadge></>}</>} />
            ),
          },
          {
            key: "progresso", header: "Progresso", render: (p) => {
              const g = progressoParcelamento(p)
              return (
                <span className={styles.progressoCelula}>
                  <span className={styles.valorLinha}>{p.parcelasPagas}/{p.quantidadeParcelas}</span>
                  <PontesProgress value={g.pct} showValue={false} height={4} />
                </span>
              )
            },
          },
          { key: "parcela", header: "Parcela", numerica: true, render: (p) => (p.proximaParcela ? formatMoney(p.proximaParcela.valor) : "—") },
          { key: "proxima", header: "Próxima fatura", render: (p) => progressoParcelamento(p).proxima ?? "—" },
          { key: "termina", header: "Termina", render: (p) => progressoParcelamento(p).termina ?? "—" },
          { key: "falta", header: "Falta", numerica: true, render: (p) => <span className={styles.valorLinha}>{formatMoney(p.valorRestante)}</span> },
        ]}
      />

      <NovoParcelamentoModal key={lab.novo.key} aberto={lab.novo.aberto} onFechar={lab.fecharNovo}
        onCriado={lab.carregar} cartoes={lab.cartoes} notify={lab.notify} cartaoInicialId={lab.novo.cartaoId} />
    </div>
  )
}
