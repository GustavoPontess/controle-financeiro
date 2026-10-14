// Bancada de Cartões — A · Painel: seletor compacto de cartões, fatura e limite lado a lado, linha de
// meses com o valor de cada fatura e a fatura como tabela (mesmo componente de Transações).
import { Plus } from "lucide-react"
import { PontesButton, PontesCard } from "@/components/pontes"
import CartoesAbas from "../CartoesAbas"
import CartoesModais from "../CartoesModais"
import { useCartoesLogic } from "../useCartoesLogic"
import CartoesLabNav from "./CartoesLabNav"
import { AcoesCartao, CarregandoFatura, FaturaTabela, IdentidadeCartao, LinhaMeses, ResumoFatura, ResumoLimite, SemCartoes } from "./LabPecas"
import styles from "./CartoesLab.module.css"

export default function CartoesLabA() {
  const logic = useCartoesLogic({ autoSelecionar: "primeiro" })
  const { cartoes, cartaoAtivo, loadingFaturas } = logic
  const f = logic.ciclos[logic.idxSelecionado]

  return (
    <div className={styles.root}>
      <CartoesLabNav atual="a" />
      <div className={styles.header}>
        <CartoesAbas />
        <PontesButton size="sm" iconStart={<Plus size={16} strokeWidth={2.5} />} onClick={logic.openCreate}>Novo cartão</PontesButton>
      </div>

      {cartoes.length === 0 ? <SemCartoes logic={logic} /> : (
        <>
          <div className={styles.seletor} role="tablist" aria-label="Cartões">
            {cartoes.map((c) => (
              <button key={c.id} type="button" role="tab" aria-selected={c.id === cartaoAtivo?.id}
                className={styles.chipCartao} data-sel={c.id === cartaoAtivo?.id ? "true" : undefined}
                disabled={!c.temCredito} onClick={() => void logic.abrirCartao(c.id)}>
                <IdentidadeCartao cartao={c} />
              </button>
            ))}
            {cartaoAtivo && <span className={styles.seletorAcoes}><AcoesCartao logic={logic} cartao={cartaoAtivo} /></span>}
          </div>

          {cartaoAtivo && (loadingFaturas || !f ? <CarregandoFatura /> : (
            <>
              <div className={styles.duasColunas}>
                <PontesCard padding={20} radius={16}><ResumoFatura logic={logic} f={f} /></PontesCard>
                <PontesCard padding={20} radius={16}><ResumoLimite cartao={cartaoAtivo} /></PontesCard>
              </div>
              <LinhaMeses logic={logic} />
              <FaturaTabela logic={logic} f={f} />
            </>
          ))}
        </>
      )}

      <CartoesModais logic={logic} />
    </div>
  )
}
