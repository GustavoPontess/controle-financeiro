// Bancada de Cartões — B · Explorador: coluna fixa com os cartões; o escolhido abre o menu das partes
// dele (Fatura, Parcelamentos, Assinaturas, Dados) com o valor de cada uma; embaixo, os totais de todos
// os cartões. A parte escolhida ocupa o resto da tela.
import { useState, type ReactNode } from "react"
import { useLocation } from "react-router-dom"
import { CreditCard, Layers, Plus, ReceiptText, Repeat } from "lucide-react"
import { PontesButton, PontesCard, PontesIconButton, PontesProgress } from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import CartoesModais from "../CartoesModais"
import NovoParcelamentoModal from "../../Parcelamentos/NovoParcelamentoModal"
import { useCartoesLogic } from "../useCartoesLogic"
import CartoesLabNav from "./CartoesLabNav"
import { CarregandoFatura, FaturaPorDia, IdentidadeCartao, NavMes, ResumoFatura, SemCartoes } from "./LabPecas"
import { AssinaturasLista, DetalhesCartao, FiltroSituacao, ParcelamentosLista } from "./SecoesCartao"
import { assinaturasDoCartao, custoMensal, useParcelamentosLab } from "./useParcelamentosLab"
import styles from "./CartoesLab.module.css"

type Secao = "fatura" | "parcelamentos" | "assinaturas" | "cartao"

export default function CartoesLabB() {
  const logic = useCartoesLogic({ autoSelecionar: "primeiro" })
  const parc = useParcelamentosLab()
  const { pathname } = useLocation()
  const [secao, setSecao] = useState<Secao>(pathname.endsWith("/parcelamentos") ? "parcelamentos" : "fatura")
  const { cartoes, cartaoAtivo, loadingFaturas, ciclos, atualIdx } = logic
  const f = ciclos[logic.idxSelecionado]
  const atual = ciclos[atualIdx]

  const parcelamentos = parc.itens === null ? null : parc.itens.filter((p) => p.cartaoCreditoId === cartaoAtivo?.id)
  const parceladoAPagar = (parcelamentos ?? []).filter((p) => p.ativo).reduce((s, p) => s + p.valorRestante, 0)
  const assinaturas = assinaturasDoCartao(logic.recorrentes, cartaoAtivo?.id)
  const assinaturasMes = assinaturas.reduce((s, r) => s + custoMensal(r), 0)

  const itensMenu: { secao: Secao; rotulo: string; icone: ReactNode; valor?: string }[] = [
    { secao: "fatura", rotulo: "Fatura", icone: <ReceiptText size={16} strokeWidth={2.5} />, valor: atual && !atual.vazia ? formatMoney(atual.valorRestante > 0 ? atual.valorRestante : atual.valorTotal) : undefined },
    { secao: "parcelamentos", rotulo: "Parcelamentos", icone: <Layers size={16} strokeWidth={2.5} />, valor: formatMoney(parceladoAPagar) },
    { secao: "assinaturas", rotulo: "Assinaturas", icone: <Repeat size={16} strokeWidth={2.5} />, valor: `${formatMoney(assinaturasMes)}/mês` },
    { secao: "cartao", rotulo: "Dados do cartão", icone: <CreditCard size={16} strokeWidth={2.5} /> },
  ]

  return (
    <div className={styles.root}>
      <CartoesLabNav atual="b" secao={secao === "parcelamentos" ? "parcelamentos" : "cartoes"} />

      {cartoes.length === 0 ? <SemCartoes logic={logic} /> : (
        <div className={styles.mestreDetalhe}>
          <aside className={styles.arvore} aria-label="Cartões">
            <div className={styles.arvoreTopo}>
              <span className={styles.arvoreTitulo}>Meus cartões</span>
              <PontesIconButton size={32} variant="ghost" aria-label="Novo cartão" onClick={logic.openCreate}><Plus size={16} strokeWidth={2.5} /></PontesIconButton>
            </div>
            {cartoes.map((c) => {
              const sel = c.id === cartaoAtivo?.id
              const pct = c.limite ? Math.min(((c.limiteUsado ?? 0) / c.limite) * 100, 100) : 0
              return (
                <div key={c.id} className={styles.arvoreGrupo} data-sel={sel ? "true" : undefined}>
                  <button type="button" className={styles.arvoreCartao} disabled={!c.temCredito} onClick={() => void logic.abrirCartao(c.id)}>
                    <IdentidadeCartao cartao={c} />
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
                  {sel && (
                    <nav className={styles.subnav} aria-label={`Partes do cartão ${c.nome}`}>
                      {itensMenu.map((it) => (
                        <button key={it.secao} type="button" className={styles.subnavItem} data-sel={secao === it.secao ? "true" : undefined}
                          onClick={() => setSecao(it.secao)}>
                          <span className={styles.subnavRotulo}>{it.icone}{it.rotulo}</span>
                          {it.valor && <span className={styles.subnavValor}>{it.valor}</span>}
                        </button>
                      ))}
                    </nav>
                  )}
                </div>
              )
            })}
            <div className={styles.arvoreTotais}>
              <span className={styles.itemCartaoLinha}><span className={styles.muted}>Limite total</span><span className={styles.valorLinha}>{formatMoney(logic.totalLimite)}</span></span>
              <span className={styles.itemCartaoLinha}><span className={styles.muted}>Usado</span><span className={styles.valorLinha}>{formatMoney(logic.totalUsado)}</span></span>
              <span className={styles.itemCartaoLinha}><span className={styles.muted}>Disponível</span><span data-tom="entrada" className={styles.valorLinha}>{formatMoney(logic.totalDisp)}</span></span>
            </div>
          </aside>

          {cartaoAtivo && (
            <PontesCard padding={0} radius={16}>
              {secao === "fatura" && (loadingFaturas || !f ? <CarregandoFatura /> : (
                <>
                  <div className={styles.detalheResumos}><ResumoFatura logic={logic} f={f} /></div>
                  <NavMes logic={logic} />
                  <FaturaPorDia logic={logic} f={f} />
                </>
              ))}
              {secao === "parcelamentos" && (
                <>
                  <div className={styles.painelTopo}>
                    <h2 className={styles.painelTitulo}>Parcelamentos</h2>
                    <span className={styles.painelAcoes}>
                      <FiltroSituacao filtro={parc.filtro} setFiltro={parc.setFiltro} />
                      <PontesButton size="sm" iconStart={<Plus size={16} strokeWidth={2.5} />} onClick={() => parc.abrirNovo(cartaoAtivo.id)}>Novo</PontesButton>
                    </span>
                  </div>
                  <ParcelamentosLista itens={parcelamentos} />
                </>
              )}
              {secao === "assinaturas" && (
                <>
                  <div className={styles.painelTopo}><h2 className={styles.painelTitulo}>Assinaturas no cartão</h2></div>
                  <AssinaturasLista itens={assinaturas} />
                </>
              )}
              {secao === "cartao" && (
                <>
                  <div className={styles.painelTopo}><h2 className={styles.painelTitulo}>Dados do cartão</h2></div>
                  <div className={styles.estado}><DetalhesCartao logic={logic} cartao={cartaoAtivo} /></div>
                </>
              )}
            </PontesCard>
          )}
        </div>
      )}

      <CartoesModais logic={logic} />
      <NovoParcelamentoModal key={parc.novo.key} aberto={parc.novo.aberto} onFechar={parc.fecharNovo}
        onCriado={async () => { await parc.carregar(); if (cartaoAtivo) await logic.abrirCartao(cartaoAtivo.id) }}
        cartoes={parc.cartoes} notify={parc.notify} cartaoInicialId={parc.novo.cartaoId} />
    </div>
  )
}
