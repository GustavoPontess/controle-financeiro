// Bancada de Cartões — A · Central do cartão: tudo pendurado no cartão escolhido. Topo = os cartões +
// os 4 números que importam (fatura atual, limite, parcelado, assinaturas); embaixo, as partes do
// cartão em abas: Fatura | Parcelamentos | Assinaturas | Cartão.
import { useState } from "react"
import { useLocation } from "react-router-dom"
import { Plus } from "lucide-react"
import { PontesButton, PontesCard, PontesProgress, PontesTabs } from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import CartoesModais from "../CartoesModais"
import NovoParcelamentoModal from "../../Parcelamentos/NovoParcelamentoModal"
import { useCartoesLogic } from "../useCartoesLogic"
import { formatDate } from "../cartoesFormato"
import CartoesLabNav from "./CartoesLabNav"
import { CarregandoFatura, FaturaTabela, IdentidadeCartao, LinhaMeses, ResumoFatura, SemCartoes } from "./LabPecas"
import { AssinaturasLista, DetalhesCartao, ParcelamentosTabela } from "./SecoesCartao"
import { assinaturasDoCartao, custoMensal, useParcelamentosLab } from "./useParcelamentosLab"
import styles from "./CartoesLab.module.css"

type Secao = "fatura" | "parcelamentos" | "assinaturas" | "cartao"

export default function CartoesLabA() {
  const logic = useCartoesLogic({ autoSelecionar: "primeiro" })
  const parc = useParcelamentosLab()
  const { pathname } = useLocation()
  const [secao, setSecao] = useState<Secao>(pathname.endsWith("/parcelamentos") ? "parcelamentos" : "fatura")
  const { cartoes, cartaoAtivo, loadingFaturas, ciclos, atualIdx, now } = logic
  const f = ciclos[logic.idxSelecionado]
  const atual = ciclos[atualIdx]

  const parcelamentos = parc.itens === null ? null : parc.itens.filter((p) => p.cartaoCreditoId === cartaoAtivo?.id)
  const parceladoAPagar = (parcelamentos ?? []).filter((p) => p.ativo).reduce((s, p) => s + p.valorRestante, 0)
  const assinaturas = assinaturasDoCartao(logic.recorrentes, cartaoAtivo?.id)
  const assinaturasMes = assinaturas.reduce((s, r) => s + custoMensal(r), 0)
  const venceEm = atual && !atual.vazia ? Math.round((new Date(atual.dataVencimento).getTime() - now) / 86_400_000) : null
  const usadoPct = cartaoAtivo?.limite ? Math.min(((cartaoAtivo.limiteUsado ?? 0) / cartaoAtivo.limite) * 100, 100) : 0

  return (
    <div className={styles.root}>
      <CartoesLabNav atual="a" secao={secao === "parcelamentos" ? "parcelamentos" : "cartoes"} />

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
            <button type="button" className={styles.chipNovo} onClick={logic.openCreate}>
              <Plus size={16} strokeWidth={2.5} aria-hidden="true" /> Novo cartão
            </button>
          </div>

          {cartaoAtivo && (
            <>
              <div className={styles.kpis}>
                <PontesCard padding={16} radius={14}>
                  <div className={styles.kpi}>
                    <span className={styles.rotulo}>Fatura atual</span>
                    <span className={styles.kpiValor}>{atual ? formatMoney(atual.valorRestante > 0 ? atual.valorRestante : atual.valorTotal) : "—"}</span>
                    <span className={styles.muted}>
                      {venceEm == null ? "sem fatura" : venceEm < 0 ? `venceu ${formatDate(atual!.dataVencimento)}` : venceEm === 0 ? "vence hoje" : `vence em ${venceEm} dias`}
                    </span>
                  </div>
                </PontesCard>
                <PontesCard padding={16} radius={14}>
                  <div className={styles.kpi}>
                    <span className={styles.rotulo}>Limite disponível</span>
                    <span className={styles.kpiValor} data-tom="entrada">{formatMoney(cartaoAtivo.limiteDisponivel ?? 0)}</span>
                    <PontesProgress value={usadoPct} showValue={false} height={6} color={usadoPct > 80 ? "var(--pontes-danger)" : "var(--pontes-primary)"} />
                    <span className={styles.muted}>de {formatMoney(cartaoAtivo.limite ?? 0)}</span>
                  </div>
                </PontesCard>
                <PontesCard padding={16} radius={14}>
                  <button type="button" className={styles.kpiBotao} onClick={() => setSecao("parcelamentos")}>
                    <span className={styles.rotulo}>Parcelado a pagar</span>
                    <span className={styles.kpiValor}>{formatMoney(parceladoAPagar)}</span>
                    <span className={styles.muted}>{(parcelamentos ?? []).filter((p) => p.ativo).length} em andamento</span>
                  </button>
                </PontesCard>
                <PontesCard padding={16} radius={14}>
                  <button type="button" className={styles.kpiBotao} onClick={() => setSecao("assinaturas")}>
                    <span className={styles.rotulo}>Assinaturas</span>
                    <span className={styles.kpiValor}>{formatMoney(assinaturasMes)}<span className={styles.muted}>/mês</span></span>
                    <span className={styles.muted}>{assinaturas.length} no cartão</span>
                  </button>
                </PontesCard>
              </div>

              <div className={styles.header}>
                <PontesTabs<Secao> variant="underline" value={secao} onChange={setSecao} options={[
                  { value: "fatura", label: "Fatura" },
                  { value: "parcelamentos", label: <>Parcelamentos <span className={styles.contador}>{(parcelamentos ?? []).filter((p) => p.ativo).length}</span></> },
                  { value: "assinaturas", label: <>Assinaturas <span className={styles.contador}>{assinaturas.length}</span></> },
                  { value: "cartao", label: "Cartão" },
                ]} />
                {secao === "parcelamentos" && (
                  <PontesButton size="sm" iconStart={<Plus size={16} strokeWidth={2.5} />} onClick={() => parc.abrirNovo(cartaoAtivo.id)}>Novo parcelamento</PontesButton>
                )}
              </div>

              {secao === "fatura" && (loadingFaturas || !f ? <CarregandoFatura /> : (
                <>
                  <LinhaMeses logic={logic} />
                  <PontesCard padding={20} radius={16}><ResumoFatura logic={logic} f={f} /></PontesCard>
                  <FaturaTabela logic={logic} f={f} />
                </>
              ))}
              {secao === "parcelamentos" && <ParcelamentosTabela itens={parcelamentos} filtro={parc.filtro} setFiltro={parc.setFiltro} />}
              {secao === "assinaturas" && <PontesCard padding={0} radius={16}><AssinaturasLista itens={assinaturas} /></PontesCard>}
              {secao === "cartao" && <PontesCard padding={20} radius={16}><DetalhesCartao logic={logic} cartao={cartaoAtivo} /></PontesCard>}
            </>
          )}
        </>
      )}

      <CartoesModais logic={logic} />
      <NovoParcelamentoModal key={parc.novo.key} aberto={parc.novo.aberto} onFechar={parc.fecharNovo}
        onCriado={async () => { await parc.carregar(); if (cartaoAtivo) await logic.abrirCartao(cartaoAtivo.id) }}
        cartoes={parc.cartoes} notify={parc.notify} cartaoInicialId={parc.novo.cartaoId} />
    </div>
  )
}
