/**
 * ReconciliacaoEstados — galeria DEV (/reconciliacao-estados) com TODOS os modos do painel de
 * conferir, lado a lado, usando o CSS REAL (ReconciliacaoPage.module.css) e dados fake. Proposta de
 * layout UNIFORME: mesma estrutura em todo estado (input → calculado/declarado/diferença → slot de
 * aviso de altura fixa → ações ancoradas no rodapé) → todas as caixas com a MESMA altura, nada
 * escondido. Não vai pro build de produção (rota atrás de DEV).
 */

import type { ReactNode } from "react"
import { Flag, Check, TriangleAlert, Trash2 } from "lucide-react"
import { PontesField, PontesInput, PontesButton, PontesSelect, PontesDateInput } from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import styles from "./ReconciliacaoPage.module.css"

type Status = { tone: "aviso" | "tag" | "nota"; text: string }
type Acao = { label: string; variant?: "primary" | "outline" | "danger-outline"; icon?: ReactNode }

type ModoProps = {
  flag?: boolean
  titulo: string
  data: string
  saldoReal: string
  inputDesabilitado?: boolean
  calculado: number
  declarado: number
  status?: Status
  acoes: Acao[]
}

// Painel UNIFORME: todo estado tem as mesmas zonas, na mesma ordem e altura.
function PainelUniforme({ flag, titulo, data, saldoReal, inputDesabilitado, calculado, declarado, status, acoes }: ModoProps) {
  const dif = declarado - calculado
  const bate = Math.abs(dif) < 0.005
  return (
    <div className={styles.painel} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div className={styles.painelSel}>
        <PontesField label="Conta a conferir" helper="Tudo nesta tela é desta conta.">
          <PontesSelect value="c1" onChange={() => {}} options={[{ value: "c1", label: "Conta Corrente" }]} />
        </PontesField>
      </div>

      <div className={styles.painelTitulo}>
        {flag && <Flag size={15} strokeWidth={2.2} />} {titulo} <strong className={styles.diaSelLabel}>{data}</strong>
      </div>

      <div style={{ marginTop: 10 }}>
        <PontesField label="Saldo real da conta">
          <PontesInput iconStart="R$" inputMode="decimal" placeholder="0,00" value={saldoReal} onChange={() => {}} disabled={inputDesabilitado} />
        </PontesField>
      </div>

      <div className={styles.resultado}>
        <div className={styles.resultLinha}><span>Calculado (app)</span><strong>{formatMoney(calculado)}</strong></div>
        <div className={styles.resultLinha}><span>Declarado (você)</span><strong>{formatMoney(declarado)}</strong></div>
        <div className={styles.resultLinha} data-destaque="true">
          <span>Diferença</span>
          <strong className={bate ? styles.difOk : styles.difNok}>{dif > 0 ? "+" : ""}{formatMoney(dif)}</strong>
        </div>
      </div>

      {/* Slot de aviso com altura fixa → caixas não dançam quando um estado tem aviso e outro não. */}
      <div style={{ minHeight: 44, marginTop: 10, display: "flex", alignItems: "flex-start" }}>
        {status?.tone === "aviso" && <div className={styles.resultAviso}><TriangleAlert size={14} strokeWidth={2.5} /> {status.text}</div>}
        {status?.tone === "tag" && <div className={styles.tag}>{status.text}</div>}
        {status?.tone === "nota" && <div className={styles.notaDerivado}>{status.text}</div>}
      </div>

      {/* Ações ancoradas no rodapé (margin-top:auto) → todas as caixas alinham embaixo. */}
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8, paddingTop: 10 }}>
        {acoes.map((a, i) => (
          <PontesButton key={i} variant={a.variant ?? "primary"} size="sm" fullWidth iconStart={a.icon}>{a.label}</PontesButton>
        ))}
      </div>
    </div>
  )
}

function Caso({ titulo, quando, children }: { titulo: string; quando: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 360, flexShrink: 0 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--pontes-text)" }}>{titulo}</div>
        <div style={{ fontSize: 12, color: "var(--pontes-text-muted)" }}>{quando}</div>
      </div>
      {children}
    </div>
  )
}

export default function ReconciliacaoEstados() {
  return (
    <div style={{ padding: 24, fontFamily: "var(--pontes-font)", background: "var(--pontes-bg)", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--pontes-text)", margin: "0 0 4px" }}>
        Reconciliação — estados do painel (layout uniforme)
      </h1>
      <p style={{ fontSize: 13, color: "var(--pontes-text-muted)", margin: "0 0 20px" }}>
        Galeria DEV. Mesma estrutura em todo estado → mesma altura, ações no rodapé, nada escondido.
      </p>

      <div style={{ display: "flex", gap: 24, alignItems: "stretch", overflowX: "auto", paddingBottom: 16 }}>
        <Caso titulo="1. Conferindo (sem digitar)" quando="Dia sem marco; o calculado do app já aparece.">
          <PainelUniforme flag titulo="Conferir" data="02/10" saldoReal="" calculado={4204.2} declarado={0}
            status={{ tone: "aviso", text: "Faltou (ou sobrou) lançamento — desde 16/09." }}
            acoes={[{ label: "Lançar o que falta", variant: "outline" }, { label: "Ajustar (cria lançamento)" }]} />
        </Caso>

        <Caso titulo="2. Digitou e bate" quando="Saldo real = calculado. Confere e grava.">
          <PainelUniforme flag titulo="Conferir" data="02/10" saldoReal="4.204,20" calculado={4204.2} declarado={4204.2}
            acoes={[{ label: "Confere — gravar marco", icon: <Check size={14} strokeWidth={3} /> }]} />
        </Caso>

        <Caso titulo="3. Digitou e não bate" quando="Diferença ≠ 0 numa verificação. Lança ou ajusta.">
          <PainelUniforme flag titulo="Conferir" data="02/10" saldoReal="4.000,00" calculado={4204.2} declarado={4000}
            status={{ tone: "aviso", text: "Faltou (ou sobrou) lançamento — desde 16/09." }}
            acoes={[{ label: "Lançar o que falta", variant: "outline" }, { label: "Ajustar (cria lançamento)" }]} />
        </Caso>

        <Caso titulo="4. Marco gravado (bateu)" quando="Dia já conferido, sem diferença.">
          <PainelUniforme titulo="Marco de" data="16/09" saldoReal="4.299,50" inputDesabilitado calculado={4299.5} declarado={4299.5}
            acoes={[{ label: "Alterar valor", variant: "outline" }, { label: "Remover", variant: "danger-outline", icon: <Trash2 size={14} strokeWidth={2.5} /> }]} />
        </Caso>

        <Caso titulo="5. Marco gravado (com ajuste)" quando="Conferiu com diferença: um ajuste fechou a conta.">
          <PainelUniforme titulo="Marco de" data="20/09" saldoReal="4.000,00" inputDesabilitado calculado={4204.2} declarado={4000}
            status={{ tone: "tag", text: "lançamento de ajuste criado" }}
            acoes={[{ label: "Alterar valor", variant: "outline" }, { label: "Remover", variant: "danger-outline", icon: <Trash2 size={14} strokeWidth={2.5} /> }]} />
        </Caso>

        <Caso titulo="6. Saldo inicial (partida)" quando="Marco derivado do saldo inicial. Aqui dá pra alterar (sem ir no cadastro).">
          <PainelUniforme titulo="Marco de" data="01/09" saldoReal="2.000,00" inputDesabilitado calculado={2000} declarado={2000}
            status={{ tone: "nota", text: "Ponto de partida da conta." }}
            acoes={[{ label: "Alterar valor", variant: "outline" }]} />
        </Caso>

        <Caso titulo="7. Saldo inicial (editando)" quando="Clicou 'Alterar valor' no marco de partida — edita valor e data aqui mesmo.">
          <div className={styles.painel} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div className={styles.painelSel}>
              <PontesField label="Conta a conferir" helper="Tudo nesta tela é desta conta.">
                <PontesSelect value="c1" onChange={() => {}} options={[{ value: "c1", label: "Conta Corrente" }]} />
              </PontesField>
            </div>
            <div className={styles.painelTitulo}><Flag size={15} strokeWidth={2.2} /> Saldo inicial <strong className={styles.diaSelLabel}>da conta</strong></div>
            <p className={styles.painelSub}>O ponto de partida da conta — vale a partir desta data.</p>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
              <PontesField label="Valor">
                <PontesInput iconStart="R$" inputMode="decimal" placeholder="0,00" value="2.000,00" onChange={() => {}} />
              </PontesField>
              <PontesField label="Desde">
                <PontesDateInput value="2026-09-01" onChange={() => {}} max="2026-10-02" />
              </PontesField>
            </div>
            <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8, paddingTop: 10 }}>
              <PontesButton variant="primary" size="sm" fullWidth iconStart={<Check size={14} strokeWidth={3} />}>Salvar saldo inicial</PontesButton>
              <PontesButton variant="outline" size="sm" fullWidth>Cancelar</PontesButton>
            </div>
          </div>
        </Caso>
      </div>
    </div>
  )
}
