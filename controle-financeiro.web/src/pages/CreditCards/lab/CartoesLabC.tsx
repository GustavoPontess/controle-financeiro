// Bancada de Cartões — C · Extrato do banco: faixa na cor do banco com a fatura atual e o limite (como o
// app do banco), linha de meses, lançamentos por dia e, do lado, os parcelamentos DESTE cartão.
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Banknote, Layers, Plus } from "lucide-react"
import { PontesButton, PontesCard, PontesProgress, PontesSegmented } from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import { ParcelamentoService } from "../../../services/ParcelamentoService"
import type { Parcelamento } from "../../../types/Parcelamento"
import CartoesAbas from "../CartoesAbas"
import CartoesModais from "../CartoesModais"
import { useCartoesLogic } from "../useCartoesLogic"
import { cardGradient, formatDate } from "../cartoesFormato"
import { rotuloMesFatura } from "../ciclosFatura"
import CartoesLabNav from "./CartoesLabNav"
import { AcoesCartao, CarregandoFatura, FaturaPorDia, LinhaMeses, LinkParcelamentos, SemCartoes } from "./LabPecas"
import styles from "./CartoesLab.module.css"

export default function CartoesLabC() {
  const logic = useCartoesLogic({ autoSelecionar: "primeiro" })
  const { cartoes, cartaoAtivo, loadingFaturas, idxSelecionado, atualIdx } = logic
  const f = logic.ciclos[idxSelecionado]
  const navigate = useNavigate()

  const [parcelamentos, setParcelamentos] = useState<Parcelamento[] | null>(null)
  useEffect(() => {
    ParcelamentoService.listar(true).then(setParcelamentos).catch(() => setParcelamentos([]))
  }, [])
  const doCartao = (parcelamentos ?? []).filter((p) => p.cartaoCreditoId === cartaoAtivo?.id)

  const credito = cartoes.filter((c) => c.temCredito)
  const aberta = !!f && f.valorRestante > 0
  const podePagar = !!f && aberta && !f.prevista && !f.vazia && new Date(f.dataInicio).getTime() <= logic.now

  return (
    <div className={styles.root}>
      <CartoesLabNav atual="c" />
      <div className={styles.header}>
        <CartoesAbas />
        <PontesButton size="sm" iconStart={<Plus size={16} strokeWidth={2.5} />} onClick={logic.openCreate}>Novo cartão</PontesButton>
      </div>

      {cartoes.length === 0 ? <SemCartoes logic={logic} /> : (
        <>
          {credito.length > 1 && (
            <PontesSegmented ariaLabel="Cartão" value={cartaoAtivo?.id ?? ""}
              options={credito.map((c) => ({ value: c.id, label: c.nome }))}
              onChange={(id) => void logic.abrirCartao(id)} />
          )}

          {cartaoAtivo && (
            // Cor do banco (dado do cartão, valor de runtime) — mesmo gradiente do cartão físico da tela atual.
            <div className={styles.faixa} style={{ background: cardGradient(cartaoAtivo.bancoCor, cartaoAtivo.bandeira) }}>
              <div className={styles.faixaTopo}>
                <span className={styles.faixaCartao}>{cartaoAtivo.nome}{cartaoAtivo.ultimosDigitos ? ` •••• ${cartaoAtivo.ultimosDigitos}` : ""}</span>
                <span className={styles.faixaAcoes}><AcoesCartao logic={logic} cartao={cartaoAtivo} /></span>
              </div>
              {f && (
                <div className={styles.faixaCorpo}>
                  <div>
                    <span className={styles.faixaRotulo}>
                      {idxSelecionado === atualIdx ? "Fatura atual" : `Fatura de ${rotuloMesFatura(f.dataFechamento).toLowerCase()}`}
                    </span>
                    <span className={styles.faixaValor}>{formatMoney(aberta ? f.valorRestante : f.valorTotal)}</span>
                    {!f.vazia && <span className={styles.faixaMeta}>{f.vencida ? "Venceu" : "Vence"} {formatDate(f.dataVencimento)} · fecha {formatDate(f.dataFechamento)}</span>}
                  </div>
                  <div className={styles.faixaDireita}>
                    {cartaoAtivo.limite ? (
                      <span className={styles.faixaLimite}>
                        <span className={styles.faixaRotulo}>Limite disponível</span>
                        <span className={styles.faixaLimiteValor}>{formatMoney(cartaoAtivo.limiteDisponivel ?? 0)}</span>
                      </span>
                    ) : null}
                    {podePagar && (
                      <PontesButton size="sm" variant="soft" iconStart={<Banknote size={16} strokeWidth={2.5} />}
                        onClick={() => logic.openPagar(f.id, cartaoAtivo.id, f.valorRestante, cartaoAtivo.contaId)}>
                        Pagar fatura
                      </PontesButton>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {cartaoAtivo && (loadingFaturas || !f ? <CarregandoFatura /> : (
            <>
              <LinhaMeses logic={logic} />
              <div className={styles.extratoGrid}>
                <PontesCard padding={0} radius={16}><FaturaPorDia logic={logic} f={f} /></PontesCard>
                <PontesCard padding={16} radius={16}>
                  <div className={styles.parcTopo}>
                    <span className={styles.parcTitulo}><Layers size={16} strokeWidth={2.5} aria-hidden="true" /> Parcelamentos</span>
                    <LinkParcelamentos />
                  </div>
                  {parcelamentos === null ? <span className={styles.muted}>Carregando…</span>
                    : doCartao.length === 0 ? <span className={styles.muted}>Nenhum parcelamento ativo neste cartão.</span>
                    : (
                      <div className={styles.parcLista}>
                        {doCartao.map((p) => (
                          <button key={p.id} type="button" className={styles.parcItem}
                            onClick={() => navigate(`/credit-cards/parcelamentos/${p.id}`)}>
                            <span className={styles.parcLinha}>
                              <span className={styles.parcNome}>{p.descricao}</span>
                              <span className={styles.valorLinha}>{p.proximaParcela ? formatMoney(p.proximaParcela.valor) : ""}</span>
                            </span>
                            <PontesProgress value={(p.parcelasPagas / p.quantidadeParcelas) * 100} showValue={false} height={4} />
                            <span className={styles.parcLinha}>
                              <span className={styles.muted}>{p.parcelasPagas} de {p.quantidadeParcelas} pagas</span>
                              <span className={styles.muted}>falta {formatMoney(p.valorRestante)}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                </PontesCard>
              </div>
            </>
          ))}
        </>
      )}

      <CartoesModais logic={logic} />
    </div>
  )
}
