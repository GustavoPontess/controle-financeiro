// Bancada de Cartões — C · App do banco: uma página só, sem abas, como o app do banco no celular.
// Carrossel dos cartões (na cor do banco) → fatura atual em destaque → atalhos (pagar, parcelar,
// editar) → seções Fatura, Parcelamentos e Assinaturas, uma embaixo da outra.
import { useEffect, useRef } from "react"
import { useLocation } from "react-router-dom"
import { Banknote, Layers, Pencil, Plus, Repeat, Trash2 } from "lucide-react"
import { PontesCard } from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import CartoesModais from "../CartoesModais"
import NovoParcelamentoModal from "../../Parcelamentos/NovoParcelamentoModal"
import BandeiraMark from "../BandeiraMark"
import { useCartoesLogic } from "../useCartoesLogic"
import { cardGradient, formatDate } from "../cartoesFormato"
import { rotuloMesFatura } from "../ciclosFatura"
import CartoesLabNav from "./CartoesLabNav"
import { CarregandoFatura, FaturaPorDia, LinhaMeses, SemCartoes } from "./LabPecas"
import { AssinaturasLista, FiltroSituacao, ParcelamentosBlocos } from "./SecoesCartao"
import { assinaturasDoCartao, custoMensal, useParcelamentosLab } from "./useParcelamentosLab"
import styles from "./CartoesLab.module.css"

export default function CartoesLabC() {
  const logic = useCartoesLogic({ autoSelecionar: "primeiro" })
  const parc = useParcelamentosLab()
  const { pathname } = useLocation()
  const vemDeParcelamentos = pathname.endsWith("/parcelamentos")
  const { cartoes, cartaoAtivo, loadingFaturas, ciclos, idxSelecionado, atualIdx, now } = logic
  const f = ciclos[idxSelecionado]

  const parcelamentos = parc.itens === null ? null : parc.itens.filter((p) => p.cartaoCreditoId === cartaoAtivo?.id)
  const parceladoAPagar = (parcelamentos ?? []).filter((p) => p.ativo).reduce((s, p) => s + p.valorRestante, 0)
  const assinaturas = assinaturasDoCartao(logic.recorrentes, cartaoAtivo?.id)
  const assinaturasMes = assinaturas.reduce((s, r) => s + custoMensal(r), 0)

  const aberta = !!f && f.valorRestante > 0
  const podePagar = !!f && aberta && !f.prevista && !f.vazia && new Date(f.dataInicio).getTime() <= now

  // Vindo da aba Parcelamentos (passador), desce direto pra seção.
  const secaoParcelamentos = useRef<HTMLElement | null>(null)
  const rolou = useRef(false)
  useEffect(() => {
    if (!vemDeParcelamentos || rolou.current || parc.itens === null || !cartaoAtivo) return
    rolou.current = true
    secaoParcelamentos.current?.scrollIntoView({ block: "start" })
  }, [vemDeParcelamentos, parc.itens, cartaoAtivo])

  return (
    <div className={styles.root}>
      <CartoesLabNav atual="c" secao={vemDeParcelamentos ? "parcelamentos" : "cartoes"} />

      {cartoes.length === 0 ? <SemCartoes logic={logic} /> : (
        <>
          <div className={styles.carrossel} role="tablist" aria-label="Cartões">
            {cartoes.map((c) => (
              // Cor do banco (dado do cartão, valor de runtime) — o cartão "físico" da tela atual, menor.
              <button key={c.id} type="button" role="tab" aria-selected={c.id === cartaoAtivo?.id}
                className={styles.miniCartao} data-sel={c.id === cartaoAtivo?.id ? "true" : undefined}
                disabled={!c.temCredito} onClick={() => void logic.abrirCartao(c.id)}
                style={{ background: cardGradient(c.bancoCor, c.bandeira) }}>
                <span className={styles.miniTopo}>
                  <span className={styles.miniNome}>{c.nome}</span>
                  <BandeiraMark bandeira={c.bandeira} width={34} />
                </span>
                <span className={styles.miniFinal}>•••• {c.ultimosDigitos ?? "••••"}</span>
                {c.temCredito && c.limite ? (
                  <span className={styles.miniLimite}>disponível <strong>{formatMoney(c.limiteDisponivel ?? 0)}</strong></span>
                ) : null}
              </button>
            ))}
            <button type="button" className={styles.miniNovo} onClick={logic.openCreate}>
              <Plus size={20} strokeWidth={2.5} aria-hidden="true" /> Adicionar cartão
            </button>
          </div>

          {cartaoAtivo && (
            <>
              {f && (
                <div className={styles.destaque}>
                  <span className={styles.rotulo}>
                    {idxSelecionado === atualIdx ? "Fatura atual" : `Fatura de ${rotuloMesFatura(f.dataFechamento).toLowerCase()}`}
                  </span>
                  <span className={styles.destaqueValor}>{formatMoney(aberta ? f.valorRestante : f.valorTotal)}</span>
                  {!f.vazia && <span className={styles.muted}>{f.vencida ? "venceu" : "vence"} {formatDate(f.dataVencimento)} · limite disponível {formatMoney(cartaoAtivo.limiteDisponivel ?? 0)}</span>}
                </div>
              )}

              <div className={styles.atalhos}>
                <button type="button" className={styles.atalho} disabled={!podePagar}
                  onClick={() => f && logic.openPagar(f.id, cartaoAtivo.id, f.valorRestante, cartaoAtivo.contaId)}>
                  <span className={styles.atalhoIcone}><Banknote size={20} strokeWidth={2.5} /></span>Pagar fatura
                </button>
                <button type="button" className={styles.atalho} onClick={() => parc.abrirNovo(cartaoAtivo.id)}>
                  <span className={styles.atalhoIcone}><Layers size={20} strokeWidth={2.5} /></span>Parcelar compra
                </button>
                <button type="button" className={styles.atalho} onClick={() => logic.openEdit(cartaoAtivo)}>
                  <span className={styles.atalhoIcone}><Pencil size={20} strokeWidth={2.5} /></span>Editar cartão
                </button>
                <button type="button" className={styles.atalho} onClick={() => logic.pedirRemocao(cartaoAtivo.id)}>
                  <span className={styles.atalhoIcone} data-tom="perigo"><Trash2 size={20} strokeWidth={2.5} /></span>Remover
                </button>
              </div>

              <section className={styles.secao}>
                <h2 className={styles.secaoTitulo}>Fatura</h2>
                {loadingFaturas || !f ? <CarregandoFatura /> : (
                  <>
                    <LinhaMeses logic={logic} />
                    <PontesCard padding={0} radius={16}><FaturaPorDia logic={logic} f={f} /></PontesCard>
                  </>
                )}
              </section>

              <section className={styles.secao} ref={secaoParcelamentos}>
                <div className={styles.secaoTopo}>
                  <h2 className={styles.secaoTitulo}><Layers size={18} strokeWidth={2.5} aria-hidden="true" /> Parcelamentos <span className={styles.muted}>· {formatMoney(parceladoAPagar)} a pagar</span></h2>
                  <FiltroSituacao filtro={parc.filtro} setFiltro={parc.setFiltro} />
                </div>
                <ParcelamentosBlocos itens={parcelamentos} />
              </section>

              <section className={styles.secao}>
                <h2 className={styles.secaoTitulo}><Repeat size={18} strokeWidth={2.5} aria-hidden="true" /> Assinaturas <span className={styles.muted}>· {formatMoney(assinaturasMes)}/mês</span></h2>
                <PontesCard padding={0} radius={16}><AssinaturasLista itens={assinaturas} /></PontesCard>
              </section>
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
