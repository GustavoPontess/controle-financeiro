// Bancada de Cartões — A · Central do cartão. Dois níveis:
// 1) /credit-cards/lab-a — "Meus cartões": todos os cartões em blocos (fatura atual, vencimento, limite,
//    parcelado) + os totais. Nada vem selecionado.
// 2) /credit-cards/lab-a/cartao/:id — a central do cartão: os 4 números e as partes dele em abas
//    (Fatura | Parcelamentos | Assinaturas | Cartão).
import { useState } from "react"
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom"
import { ChevronLeft, Plus } from "lucide-react"
import { PontesBadge, PontesButton, PontesCard, PontesProgress, PontesSkeletonList, PontesTabs } from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import CartoesModais from "../CartoesModais"
import NovoParcelamentoModal from "../../Parcelamentos/NovoParcelamentoModal"
import { useCartoesLogic } from "../useCartoesLogic"
import CartoesLabNav from "./CartoesLabNav"
import { CarregandoFatura, FaturaTabela, IdentidadeCartao, LinhaMeses, ResumoFatura, SemCartoes } from "./LabPecas"
import { AssinaturasLista, DetalhesCartao, ParcelamentosTabela } from "./SecoesCartao"
import { assinaturasDoCartao, custoMensal, useParcelamentosLab } from "./useParcelamentosLab"
import { textoVencimento, useResumoCartoes } from "./useResumoCartoes"
import styles from "./CartoesLab.module.css"

const BASE = "/credit-cards/lab-a"

export default function CartoesLabA() {
  const { id } = useParams()
  return id ? <CentralDoCartao key={id} id={id} /> : <MeusCartoes />
}

function MeusCartoes() {
  const logic = useCartoesLogic({ autoSelecionar: "nenhum" })
  const parc = useParcelamentosLab()
  const { resumo, carregando } = useResumoCartoes(logic.cartoes, parc.itens)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { cartoes, now } = logic
  const faturasDoMes = cartoes.reduce((s, c) => s + (resumo[c.id]?.atual?.valorRestante ?? 0), 0)
  const parcelado = cartoes.reduce((s, c) => s + (resumo[c.id]?.parcelado ?? 0), 0)

  return (
    <div className={styles.root}>
      <CartoesLabNav atual="a" secao={pathname.endsWith("/parcelamentos") ? "parcelamentos" : "cartoes"} />

      {logic.carregado && cartoes.length === 0 ? <SemCartoes logic={logic} /> : (
        <>
          <div className={styles.kpis}>
            <PontesCard padding={16} radius={14}><div className={styles.kpi}>
              <span className={styles.rotulo}>Faturas deste mês</span>
              <span className={styles.kpiValor}>{formatMoney(faturasDoMes)}</span>
            </div></PontesCard>
            <PontesCard padding={16} radius={14}><div className={styles.kpi}>
              <span className={styles.rotulo}>Limite disponível</span>
              <span className={styles.kpiValor} data-tom="entrada">{formatMoney(logic.totalDisp)}</span>
              <span className={styles.muted}>de {formatMoney(logic.totalLimite)}</span>
            </div></PontesCard>
            <PontesCard padding={16} radius={14}><div className={styles.kpi}>
              <span className={styles.rotulo}>Parcelado a pagar</span>
              <span className={styles.kpiValor}>{formatMoney(parcelado)}</span>
            </div></PontesCard>
            <PontesCard padding={16} radius={14}><div className={styles.kpi}>
              <span className={styles.rotulo}>Cartões</span>
              <span className={styles.kpiValor}>{cartoes.length}</span>
            </div></PontesCard>
          </div>

          <div className={styles.gradeCartoes}>
            {cartoes.map((c) => {
              const r = resumo[c.id]
              const pct = c.limite ? Math.min(((c.limiteUsado ?? 0) / c.limite) * 100, 100) : 0
              return (
                <button key={c.id} type="button" className={styles.blocoCartao} disabled={!c.temCredito}
                  onClick={() => navigate(`${BASE}/cartao/${c.id}`)}>
                  <IdentidadeCartao cartao={c} />
                  {c.temCredito ? (
                    <>
                      <span className={styles.blocoFatura}>
                        <span className={styles.rotulo}>Fatura atual</span>
                        {carregando ? <PontesSkeletonList rows={1} /> : (
                          <>
                            <span className={styles.kpiValor}>{formatMoney(r?.atual?.valorRestante ?? 0)}</span>
                            <span className={styles.muted}>{textoVencimento(r?.atual, now)}</span>
                          </>
                        )}
                        {r?.aPagar && (
                          <PontesBadge tone={r.aPagar.vencida ? "danger" : "warning"} size="sm">
                            {formatMoney(r.aPagar.valorRestante)} da fatura fechada
                          </PontesBadge>
                        )}
                      </span>
                      {c.limite ? (
                        <span className={styles.itemCartaoLimite}>
                          <PontesProgress value={pct} showValue={false} height={6} color={pct > 80 ? "var(--pontes-danger)" : "var(--pontes-primary)"} />
                          <span className={styles.itemCartaoLinha}>
                            <span className={styles.muted}>disponível <strong data-tom="entrada">{formatMoney(c.limiteDisponivel ?? 0)}</strong></span>
                            <span className={styles.muted}>de {formatMoney(c.limite)}</span>
                          </span>
                        </span>
                      ) : null}
                      <span className={styles.muted}>
                        {r?.parcelamentosAtivos ? `parcelado ${formatMoney(r.parcelado)} · ${r.parcelamentosAtivos} em andamento` : "sem parcelamentos"}
                      </span>
                    </>
                  ) : <span className={styles.muted}>só débito</span>}
                </button>
              )
            })}
            <button type="button" className={styles.blocoNovo} onClick={logic.openCreate}>
              <Plus size={22} strokeWidth={2.5} aria-hidden="true" /> Novo cartão
            </button>
          </div>
        </>
      )}

      <CartoesModais logic={logic} />
    </div>
  )
}

type Secao = "fatura" | "parcelamentos" | "assinaturas" | "cartao"

function CentralDoCartao({ id }: { id: string }) {
  const logic = useCartoesLogic({ cartaoId: id })
  const parc = useParcelamentosLab()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [secao, setSecao] = useState<Secao>(pathname.endsWith("/parcelamentos") ? "parcelamentos" : "fatura")
  const { cartoes, cartaoAtivo, loadingFaturas, ciclos, atualIdx, now } = logic
  const f = ciclos[logic.idxSelecionado]
  const atual = ciclos[atualIdx]

  const parcelamentos = parc.itens === null ? null : parc.itens.filter((p) => p.cartaoCreditoId === id)
  const parceladoAPagar = (parcelamentos ?? []).filter((p) => p.ativo).reduce((s, p) => s + p.valorRestante, 0)
  const assinaturas = assinaturasDoCartao(logic.recorrentes, id)
  const assinaturasMes = assinaturas.reduce((s, r) => s + custoMensal(r), 0)
  const usadoPct = cartaoAtivo?.limite ? Math.min(((cartaoAtivo.limiteUsado ?? 0) / cartaoAtivo.limite) * 100, 100) : 0

  // Cartão removido (ou endereço errado): volta pra "Meus cartões".
  if (logic.carregado && !cartoes.some((c) => c.id === id && c.temCredito)) return <Navigate to={BASE} replace />

  return (
    <div className={styles.root}>
      <CartoesLabNav atual="a" secao={secao === "parcelamentos" ? "parcelamentos" : "cartoes"} cartaoId={id} />

      <div className={styles.seletor}>
        <Link to={BASE} className={styles.voltar}><ChevronLeft size={16} strokeWidth={2.5} /> Meus cartões</Link>
        {cartoes.filter((c) => c.temCredito).map((c) => (
          <button key={c.id} type="button" className={styles.chipCartao} data-sel={c.id === id ? "true" : undefined}
            onClick={() => c.id !== id && navigate(`${BASE}/cartao/${c.id}`)}>
            <IdentidadeCartao cartao={c} />
          </button>
        ))}
      </div>

      {cartaoAtivo && (
        <>
          <div className={styles.kpis}>
            <PontesCard padding={16} radius={14}><div className={styles.kpi}>
              <span className={styles.rotulo}>Fatura atual</span>
              <span className={styles.kpiValor}>{atual ? formatMoney(atual.valorRestante > 0 ? atual.valorRestante : atual.valorTotal) : "—"}</span>
              <span className={styles.muted}>{textoVencimento(atual && !atual.vazia ? atual : undefined, now)}</span>
            </div></PontesCard>
            <PontesCard padding={16} radius={14}><div className={styles.kpi}>
              <span className={styles.rotulo}>Limite disponível</span>
              <span className={styles.kpiValor} data-tom="entrada">{formatMoney(cartaoAtivo.limiteDisponivel ?? 0)}</span>
              <PontesProgress value={usadoPct} showValue={false} height={6} color={usadoPct > 80 ? "var(--pontes-danger)" : "var(--pontes-primary)"} />
              <span className={styles.muted}>de {formatMoney(cartaoAtivo.limite ?? 0)}</span>
            </div></PontesCard>
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
              <PontesButton size="sm" iconStart={<Plus size={16} strokeWidth={2.5} />} onClick={() => parc.abrirNovo(id)}>Novo parcelamento</PontesButton>
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

      <CartoesModais logic={logic} />
      <NovoParcelamentoModal key={parc.novo.key} aberto={parc.novo.aberto} onFechar={parc.fecharNovo}
        onCriado={async () => { await parc.carregar(); await logic.abrirCartao(id) }}
        cartoes={parc.cartoes} notify={parc.notify} cartaoInicialId={parc.novo.cartaoId} />
    </div>
  )
}
