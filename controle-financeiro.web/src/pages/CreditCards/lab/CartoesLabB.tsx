// Bancada de Cartões — B · Lista lateral: os cartões numa coluna (com disponível e datas), a fatura do
// cartão escolhido do lado, com ‹ mês › e os lançamentos agrupados por dia.
import { Plus } from "lucide-react"
import { PontesButton, PontesCard, PontesProgress } from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import CartoesAbas from "../CartoesAbas"
import CartoesModais from "../CartoesModais"
import { useCartoesLogic } from "../useCartoesLogic"
import CartoesLabNav from "./CartoesLabNav"
import { AcoesCartao, CarregandoFatura, FaturaPorDia, IdentidadeCartao, NavMes, ResumoFatura, ResumoLimite, SemCartoes } from "./LabPecas"
import styles from "./CartoesLab.module.css"

export default function CartoesLabB() {
  const logic = useCartoesLogic({ autoSelecionar: "primeiro" })
  const { cartoes, cartaoAtivo, loadingFaturas } = logic
  const f = logic.ciclos[logic.idxSelecionado]

  return (
    <div className={styles.root}>
      <CartoesLabNav atual="b" />
      <div className={styles.header}>
        <CartoesAbas />
        <PontesButton size="sm" iconStart={<Plus size={16} strokeWidth={2.5} />} onClick={logic.openCreate}>Novo cartão</PontesButton>
      </div>

      {cartoes.length === 0 ? <SemCartoes logic={logic} /> : (
        <div className={styles.mestreDetalhe}>
          <aside className={styles.listaCartoes} aria-label="Cartões">
            {cartoes.map((c) => {
              const pct = c.limite ? Math.min(((c.limiteUsado ?? 0) / c.limite) * 100, 100) : 0
              return (
                <button key={c.id} type="button" className={styles.itemCartao}
                  data-sel={c.id === cartaoAtivo?.id ? "true" : undefined}
                  disabled={!c.temCredito} onClick={() => void logic.abrirCartao(c.id)}>
                  <IdentidadeCartao cartao={c} sub={c.diaFechamento ? `fecha dia ${c.diaFechamento} · vence dia ${c.diaVencimento}` : undefined} />
                  {c.temCredito && c.limite ? (
                    <span className={styles.itemCartaoLimite}>
                      <span className={styles.itemCartaoLinha}>
                        <span className={styles.muted}>disponível</span>
                        <span data-tom="entrada" className={styles.valorLinha}>{formatMoney(c.limiteDisponivel ?? 0)}</span>
                      </span>
                      <PontesProgress value={pct} showValue={false} height={4} color={pct > 80 ? "var(--pontes-danger)" : "var(--pontes-primary)"} />
                    </span>
                  ) : null}
                </button>
              )
            })}
          </aside>

          {cartaoAtivo && (
            <PontesCard padding={0} radius={16}>
              <div className={styles.detalheTopo}>
                <IdentidadeCartao cartao={cartaoAtivo} />
                <AcoesCartao logic={logic} cartao={cartaoAtivo} />
              </div>
              {loadingFaturas || !f ? <CarregandoFatura /> : (
                <>
                  <div className={styles.detalheResumos}>
                    <ResumoFatura logic={logic} f={f} />
                    <ResumoLimite cartao={cartaoAtivo} />
                  </div>
                  <NavMes logic={logic} />
                  <FaturaPorDia logic={logic} f={f} />
                </>
              )}
            </PontesCard>
          )}
        </div>
      )}

      <CartoesModais logic={logic} />
    </div>
  )
}
