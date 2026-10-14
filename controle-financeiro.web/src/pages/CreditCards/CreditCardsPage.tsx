import { Link } from "react-router-dom"
import { formatMoney } from "@/utils/money"
import {
  Plus, Pencil, Trash2, CreditCard, ReceiptText, ChevronLeft, ChevronRight, Banknote, Check, Wifi, Layers,
} from "lucide-react"
import {
  PontesButton, PontesIconButton, PontesBadge, PontesCard, PontesEmptyState, PontesSkeletonList,
} from "@/components/pontes"
import CartoesAbas from "./CartoesAbas"
import CartoesModais from "./CartoesModais"
import { useCartoesLogic } from "./useCartoesLogic"
import BandeiraMark from "./BandeiraMark"
import { STATUS, cardGradient, diasAteProxDia, formatDate, statusKey } from "./cartoesFormato"
import type { CartaoCredito } from "../../types/CartaoCredito"
import type { FaturaDetalhe, FaturaPagamento, FaturaParcela } from "../../types/Fatura"
import { rotuloMesFatura, type FaturaView } from "./ciclosFatura"
import styles from "./CreditCardsPage.module.css"

export default function CreditCardsPage() {
  // Toda a lógica (dados, faturas, pagar, estornar, CRUD do cartão) mora no useCartoesLogic — a mesma
  // das bancadas de layout /credit-cards/lab-*; aqui só o visual.
  const logic = useCartoesLogic()
  const {
    now, cartoes, totalLimite, totalUsado, totalDisp, faturasCartaoId, cartaoAtivo, fecharCartao, alternarCartao,
    faturas, loadingFaturas, faturaDetalhes, ciclos, atualIdx, ultimoIdx, idxSelecionado, irParaFatura,
    openCreate, openEdit, pedirRemocao, openPagar, pedirEstorno,
  } = logic

  const renderDetalhe = (f: FaturaView) => {
    // Mês sem fatura (nenhum lançamento caiu nele). Sem fatura nenhuma no cartão, orienta o 1º uso.
    if (f.vazia) {
      if (faturas.length === 0) {
        return (
          <div className={styles.faturaEmpty}>
            <PontesEmptyState
              icon={<ReceiptText size={26} />}
              title="Nenhuma fatura ainda"
              description="Registre uma compra no crédito pra criar a primeira fatura."
            />
          </div>
        )
      }
      return <div className={styles.detailMuted}>Sem lançamentos neste mês.</div>
    }
    // Fatura prevista: lançamentos vêm das assinaturas projetadas (sem ir ao backend).
    if (f.prevista) {
      const proj = f.projLancamentos ?? []
      if (proj.length === 0) return <div className={styles.detailMuted}>Sem assinaturas previstas.</div>
      return (
        <div className={styles.txList}>
          {proj.map((l) => (
            <div key={l.id} className={styles.txRow}>
              <div className={styles.txMain}>
                <span className={styles.txDesc}>{l.descricao}</span>
                <span className={styles.txMeta}>{new Date(l.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })} · assinatura</span>
              </div>
              <span className={styles.txValor}>{formatMoney(l.valor)}</span>
            </div>
          ))}
        </div>
      )
    }
    const detalhe = faturaDetalhes[f.id]
    if (!detalhe) return <div className={styles.detailMuted}>Carregando…</div>
    const pagamentos = detalhe.pagamentos ?? []
    // Parcelas dos parcelamentos entram no total da fatura — sem elas na lista, fatura de R$ 450 só com
    // parcelas dizia "Nenhuma transação".
    const parcelas = detalhe.parcelas ?? []
    if (detalhe.transacoes.length === 0 && parcelas.length === 0 && pagamentos.length === 0)
      return <div className={styles.detailMuted}>Nenhuma transação nesta fatura.</div>

    // Linha do tempo única: compras + parcelas + pagamentos ordenados por data (cronológico).
    type Linha =
      | { kind: "compra"; id: string; ts: number; t: FaturaDetalhe["transacoes"][number] }
      | { kind: "parcela"; id: string; ts: number; par: FaturaParcela }
      | { kind: "pagamento"; id: string; ts: number; p: FaturaPagamento }
    // Ordena por data + hora (criadoEm carrega o horário do lançamento; na parcela, o do parcelamento).
    const linhas: Linha[] = [
      ...detalhe.transacoes.map((t) => ({ kind: "compra" as const, id: t.id, ts: new Date(t.criadoEm).getTime(), t })),
      ...parcelas.map((par) => ({ kind: "parcela" as const, id: par.id, ts: new Date(par.criadoEm).getTime(), par })),
      ...pagamentos.map((p) => ({ kind: "pagamento" as const, id: p.id, ts: new Date(p.criadoEm).getTime(), p })),
    ].sort((a, b) => a.ts - b.ts)

    return (
      <>
      <div className={styles.txList}>
        {linhas.map((l) => l.kind === "compra" ? (
          <div key={l.id} className={styles.txRow}>
            <div className={styles.txMain}>
              <span className={styles.txDesc}>{l.t.descricao}</span>
              <span className={styles.txMeta}>
                {new Date(l.t.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })} · {new Date(l.t.criadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                {l.t.categoriaDescricao ? ` · ${l.t.categoriaDescricao}` : ""}
              </span>
            </div>
            {/* Sem "pago" por compra: pagar a fatura só abate o total dela, não quita uma compra
                específica (é assim no banco). O quanto já foi pago fica no resumo da fatura. */}
            <span className={styles.txValor}>{formatMoney(l.t.valor)}</span>
          </div>
        ) : l.kind === "parcela" ? (
          // Mesmo visual da compra (e também sem "paga": a fatura é que é paga, não a parcela) + ícone
          // discreto de parcelado; a descrição leva ao parcelamento (onde se cancela/antecipa).
          <div key={l.id} className={styles.txRow} data-parcela="true">
            <div className={styles.txMain}>
              <span className={styles.txDesc}>
                <Layers size={13} strokeWidth={2.5} className={styles.txParcelaIcon} aria-label="Parcelado" />
                <Link to={`/credit-cards/parcelamentos/${l.par.parcelamentoId}`} className={styles.txLink}>
                  {`${l.par.descricao} (${l.par.numero}/${l.par.quantidadeTotal})`}
                </Link>
              </span>
              <span className={styles.txMeta}>
                {new Date(l.par.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })} · {new Date(l.par.criadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                {l.par.categoriaDescricao ? ` · ${l.par.categoriaDescricao}` : ""}
              </span>
            </div>
            <span className={styles.txValor}>{formatMoney(l.par.valor)}</span>
          </div>
        ) : (
          <div key={l.id} className={styles.txRow} data-pagamento="true">
            <div className={styles.txMain}>
              <span className={styles.txDesc}><Check size={13} strokeWidth={2.5} /> Pagamento · {l.p.meioPagamentoDescricao}</span>
              <span className={styles.txMeta}>
                {new Date(l.p.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })} · {new Date(l.p.criadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <span className={styles.payLado}>
              <span className={styles.payValor}>− {formatMoney(l.p.valor)}</span>
              {/* Pagamento errado (ou devolvido pelo banco) tem volta: o dinheiro volta pra conta e a
                  fatura volta a dever. Editar/excluir pagamento segue bloqueado. */}
              <PontesButton size="sm" variant="ghost"
                onClick={() => pedirEstorno({ id: l.p.id, valor: l.p.valor, cartaoId: f.cartaoCreditoId, faturaId: f.id })}>
                Estornar
              </PontesButton>
            </span>
          </div>
        ))}
      </div>
      {f.valorPago > 0 && (
        <div className={styles.paidNote}>
          <span className={styles.paidNoteLabel}>Total pago</span>
          <span className={styles.paidNoteValue}>
            {formatMoney(f.valorPago)}
            {f.valorRestante > 0 && <span className={styles.paidNoteRest}> · falta {formatMoney(f.valorRestante)}</span>}
          </span>
        </div>
      )}
      </>
    )
  }

  const renderCartao = (c: CartaoCredito) => {
    // Usado do limite (faturas em aberto + parcelas futuras − pago), não só o ciclo atual: parcelado
    // bloqueia o limite todo. Barra travada em 100% quando estoura.
    const pct = c.limite ? Math.min(((c.limiteUsado ?? 0) / c.limite) * 100, 100) : 0
    const over = pct > 80
    const sel = faturasCartaoId === c.id
    const clickable = c.temCredito
    return (
      <div
        key={c.id}
        className={styles.cardTile}
        data-selected={sel ? "true" : undefined}
        data-clickable={clickable ? "true" : undefined}
        onClick={clickable ? () => void alternarCartao(c.id) : undefined}
      >
        {/* Cartão físico — gradiente do banco se tem cor, senão bandeira */}
        <div className={styles.card} style={{ background: cardGradient(c.bancoCor, c.bandeira) }}>
          <div className={styles.cardSheen1} />
          <div className={styles.cardSheen2} />

          <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
            <PontesIconButton size={32} variant="ghost" aria-label="Editar" onClick={() => openEdit(c)}><Pencil size={14} /></PontesIconButton>
            <PontesIconButton size={32} variant="ghost" aria-label="Remover" onClick={() => pedirRemocao(c.id)}><Trash2 size={14} /></PontesIconButton>
          </div>

          <div className={styles.cardFace}>
            <div className={styles.faceTop}>
              <div className={styles.cardNameWrap}>
                <span className={styles.cardName}>{c.nome}</span>
                {c.bancoNome && <span className={styles.cardEmissor}>{c.bancoNome}</span>}
              </div>
            </div>
            <div className={styles.chipRow}>
              <div className={styles.cardChip} />
              <Wifi size={18} className={styles.contactless} />
            </div>
            <div className={styles.faceBottom}>
              <span className={styles.cardNumber}>•••• {c.ultimosDigitos ?? "••••"}</span>
              <div className={styles.bandeiraSlot}>
                <BandeiraMark bandeira={c.bandeira} />
              </div>
            </div>
          </div>
        </div>

        {/* Bloco de info — separado do cartão (fundo neutro) */}
        {c.temCredito && c.limite ? (
          <div className={styles.cardMeta}>
            <div className={styles.panelTop}>
              <div className={styles.cardDispWrap}>
                <span className={styles.cardInfoLabel}>Disponível</span>
                <span className={styles.cardDisp}>{formatMoney(c.limiteDisponivel ?? 0)}</span>
              </div>
              <div className={styles.cardInfoRight}>
                <span className={styles.cardPct} data-over={over ? "true" : undefined}>{Math.round(pct)}%</span>
                <span className={styles.cardOfLimit}>de {formatMoney(c.limite)}</span>
              </div>
            </div>
            <div className={styles.bar}><div className={styles.barFill} data-over={over ? "true" : undefined} style={{ width: `${pct}%` }} /></div>
            <div className={styles.cardMetaRow}>
              {(() => {
                const dF = diasAteProxDia(c.diaFechamento, now)
                const dV = diasAteProxDia(c.diaVencimento, now)
                // Próximos 5 dias = destaque. Vencimento prioridade sobre fechamento.
                const urgenteV = dV != null && dV <= 5
                const urgenteF = dF != null && dF <= 5
                if (urgenteV) {
                  return <span className={styles.urgentDate} data-tone="danger">vence {dV === 0 ? "hoje" : dV === 1 ? "amanhã" : `em ${dV} dias`}</span>
                }
                if (urgenteF) {
                  return <span className={styles.urgentDate} data-tone="warning">fecha {dF === 0 ? "hoje" : dF === 1 ? "amanhã" : `em ${dF} dias`}</span>
                }
                if (c.diaFechamento || c.diaVencimento) {
                  return <span>{c.diaFechamento ? `fecha dia ${c.diaFechamento}` : ""}{c.diaVencimento ? ` · vence dia ${c.diaVencimento}` : ""}</span>
                }
                return <span>{formatMoney(c.limiteUsado ?? 0)} usado</span>
              })()}
              <span className={styles.verFaturas}><ReceiptText size={12} /> {sel ? "Em foco" : "Faturas"}</span>
            </div>
          </div>
        ) : (c.contaNome || c.temDebito || c.ehPrePago) ? (
          <div className={styles.cardMeta}>
            <div className={styles.cardMetaRow}>
              <span>{c.contaNome ? "Conta que paga" : " "}</span>
              {c.contaNome && <span className={styles.cardFootValue}>{c.contaNome}</span>}
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        {/* O título já está na barra de cima; aqui ficam as abas Cartões | Parcelamentos. */}
        <CartoesAbas />
        <PontesButton size="sm" iconStart={<Plus size={16} strokeWidth={2.5} />} onClick={openCreate}>
          Novo Cartão
        </PontesButton>
      </div>

      {/* Resumo slim */}
      {cartoes.length > 0 && (
        <div className={styles.summary}>
          <div className={styles.sumItem}>
            <span className={styles.sumLabel}>Cartões</span>
            <span className={styles.sumValue}>{cartoes.length}</span>
          </div>
          <div className={styles.sumDiv} />
          <div className={styles.sumItem}>
            <span className={styles.sumLabel}>Limite total</span>
            <span className={styles.sumValue}>{formatMoney(totalLimite)}</span>
          </div>
          <div className={styles.sumDiv} />
          <div className={styles.sumItem}>
            <span className={styles.sumLabel}>Disponível</span>
            <span className={styles.sumValue} data-pos="true">{formatMoney(totalDisp)}</span>
          </div>
          <div className={styles.sumDiv} />
          <div className={styles.sumItem}>
            <span className={styles.sumLabel}>Limite usado</span>
            <span className={styles.sumValue}>{formatMoney(totalUsado)}</span>
          </div>
        </div>
      )}

      {/* Grid de cartões */}
      {cartoes.length === 0 ? (
        <PontesEmptyState
          icon={<CreditCard size={28} />}
          title="Nenhum cartão cadastrado"
          description="Adicione seus cartões de crédito, débito ou pré-pagos."
        />
      ) : faturasCartaoId && cartaoAtivo ? (
        // Modo foco: só o cartão selecionado, com a fatura logo abaixo.
        <>
          <button type="button" className={styles.backCards} onClick={fecharCartao}>
            <ChevronLeft size={16} /> Todos os cartões
          </button>
          <div className={styles.focusCard}>{renderCartao(cartaoAtivo)}</div>
        </>
      ) : (
        <div className={styles.cardsGrid}>
          {cartoes.map(renderCartao)}
        </div>
      )}

      {/* Painel de faturas */}
      {faturasCartaoId && cartaoAtivo && (
        <PontesCard padding={0} radius={16}>
          {loadingFaturas || ciclos.length === 0 ? (
            <div className={styles.faturaSkeleton}><PontesSkeletonList rows={4} /></div>
          ) : (() => {
            const idx = idxSelecionado
            const f = ciclos[idx]
            const ehPrevista = !!f.prevista
            const ehVazia = !!f.vazia
            const st = STATUS[statusKey(f, now)]
            const open = f.valorRestante > 0
            const ehAtual = idx === atualIdx
            // Ciclo ainda não começou (dataInicio > hoje) — fatura "Futura".
            // Bancos reais não permitem pagar fatura futura inteira; bloqueia botão.
            const ehFutura = !ehPrevista && !ehVazia && new Date(f.dataInicio).getTime() > now
            return (
              <div className={styles.faturaBody}>
                {/* Navegação por mês: ‹ anterior | (Hoje?) | mês | (Hoje?) | próximo › */}
                <div className={styles.monthNav}>
                  <button type="button" className={styles.monthArrow} aria-label="Mês anterior"
                    disabled={idx >= ultimoIdx} onClick={() => irParaFatura(idx + 1)}>
                    <ChevronLeft size={18} />
                  </button>
                  {idx < atualIdx && (
                    <PontesButton size="md" variant="outline" iconStart={<ChevronLeft size={16} strokeWidth={2.5} />}
                      onClick={() => irParaFatura(atualIdx)}>Hoje</PontesButton>
                  )}
                  <div className={styles.monthLabel}>
                    <span className={styles.monthName}>{rotuloMesFatura(f.dataFechamento)}{ehAtual ? " · atual" : ehPrevista ? " · prevista" : ""}</span>
                    <span className={styles.monthRange}>{formatDate(f.dataInicio)} – {formatDate(f.dataFechamento)}</span>
                  </div>
                  {idx > atualIdx && (
                    <PontesButton size="md" variant="outline" iconEnd={<ChevronRight size={16} strokeWidth={2.5} />}
                      onClick={() => irParaFatura(atualIdx)}>Hoje</PontesButton>
                  )}
                  <button type="button" className={styles.monthArrow} aria-label="Próximo mês"
                    disabled={idx <= 0} onClick={() => irParaFatura(idx - 1)}>
                    <ChevronRight size={18} />
                  </button>
                </div>

                {/* Fatura do mês selecionado */}
                <div className={styles.atual} data-open={open ? "true" : undefined}>
                  <div className={styles.atualTop}>
                    <div>
                      <div className={styles.atualValor}>{formatMoney(open ? f.valorRestante : f.valorTotal)}</div>
                      <div className={styles.atualMeta}>
                        {!ehVazia && (ehPrevista
                          ? <PontesBadge tone="neutral" size="sm">Prevista</PontesBadge>
                          : <PontesBadge tone={st.tone} size="sm">{st.label}</PontesBadge>)}
                        {!ehPrevista && !ehVazia && f.vencida && <PontesBadge tone="danger" size="sm">Vencida</PontesBadge>}
                        {!ehVazia && (
                          <span className={styles.muted}>
                            {f.vencida ? "Venceu " : "Vence "}{formatDate(f.dataVencimento)}
                          </span>
                        )}
                        {f.valorPago > 0 && open && <span className={styles.muted}>Pago {formatMoney(f.valorPago)} de {formatMoney(f.valorTotal)}</span>}
                      </div>
                    </div>
                    {open && !ehPrevista && !ehFutura && (
                      <PontesButton size="sm" iconStart={<Banknote size={16} strokeWidth={2.5} />}
                        onClick={() => openPagar(f.id, faturasCartaoId, f.valorRestante, cartaoAtivo.contaId)}>
                        Pagar
                      </PontesButton>
                    )}
                  </div>
                  {!ehPrevista && f.valorPago > 0 && open && (
                    <div className={styles.paidBar} title={`Pago ${formatMoney(f.valorPago)} de ${formatMoney(f.valorTotal)}`}>
                      <div className={styles.paidFill} style={{ width: `${Math.min(100, (f.valorPago / f.valorTotal) * 100)}%` }} />
                    </div>
                  )}
                  {renderDetalhe(f)}
                </div>
              </div>
            )
          })()}
        </PontesCard>
      )}

      <CartoesModais logic={logic} />
    </div>
  )
}
