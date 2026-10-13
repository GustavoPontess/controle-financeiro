import { useState } from "react"
import { PontesButton, PontesField, PontesInput, PontesModal, PontesSelect } from "@/components/pontes"
import {
  getFamilias, compartilharTransacao, getDependentes, atribuirDependente,
  getRateioTransacao, definirRateioTransacao, removerRateioTransacao,
} from "@/services/familiaService"
import type { Transaction } from "@/types/Transaction"
import type { Familia, Dependente, ModoRateio, RateioTransacao } from "@/types/Familia"
import styles from "./AcoesFamilia.module.css"

type Notificar = (n: { open: boolean; message: string; severity: "success" | "error" | "warning" }) => void

// Modos de rateio da despesa compartilhada (override do padrão da família).
const MODOS_RATEIO = [
  { value: "1", label: "Igualitário" },
  { value: "2", label: "Proporcional à renda" },
  { value: "3", label: "Personalizado" },
]

/** Família/rateio só valem pra DESPESA real de conta (gasto compartilhável): transferência e pagamento
 *  de fatura são neutros. */
export const podeCompartilhar = (t: Transaction) => t.tipo === 1 && !t.ehTransferencia && !t.ehPagamentoFatura

/**
 * Ações de família de uma despesa — compartilhar com a família, atribuir a um dependente e definir o
 * rateio dela — com os diálogos de escolha. Moravam no ⋮ da lista de Transações; agora ficam na tela da
 * transação. `modais` vai no JSX da tela; `onMudou` roda depois de cada ação que gravou.
 */
export function useAcoesFamilia(notify: Notificar, onMudou?: () => void) {
  const [sharing, setSharing] = useState<Transaction | null>(null)
  const [familias, setFamilias] = useState<Familia[]>([])
  const [assigning, setAssigning] = useState<Transaction | null>(null)
  const [dependentes, setDependentes] = useState<Dependente[]>([])
  const [ratear, setRatear] = useState<Transaction | null>(null)
  const [rateio, setRateio] = useState<RateioTransacao | null>(null)
  const [rateioModo, setRateioModo] = useState<ModoRateio>(1)
  const [percentuais, setPercentuais] = useState<Record<string, string>>({})
  const [rateioErro, setRateioErro] = useState<string | undefined>()

  // ── Compartilhar despesa com a família ──
  const compartilhar = async (t: Transaction) => {
    setSharing(t)
    try {
      setFamilias(await getFamilias())
    } catch {
      notify({ open: true, message: "Erro ao carregar famílias", severity: "error" })
    }
  }

  const handleShare = async (familiaId: string) => {
    if (!sharing) return
    try {
      await compartilharTransacao(sharing.id, familiaId)
      notify({ open: true, message: "Despesa compartilhada com a família", severity: "success" })
      setSharing(null)
      onMudou?.()
    } catch {
      notify({ open: true, message: "Erro ao compartilhar despesa", severity: "error" })
    }
  }

  // ── Atribuir despesa a um dependente ──
  const atribuir = async (t: Transaction) => {
    setAssigning(t)
    try {
      const fams = await getFamilias()
      const listas = await Promise.all(fams.map((f) => getDependentes(f.id)))
      setDependentes(listas.flat())
    } catch {
      notify({ open: true, message: "Erro ao carregar dependentes", severity: "error" })
    }
  }

  const handleAssign = async (dependenteId: string | null) => {
    if (!assigning) return
    try {
      await atribuirDependente(assigning.id, dependenteId)
      notify({
        open: true,
        message: dependenteId ? "Despesa atribuída ao dependente" : "Atribuição removida",
        severity: "success",
      })
      setAssigning(null)
      onMudou?.()
    } catch {
      notify({ open: true, message: "Erro ao atribuir despesa", severity: "error" })
    }
  }

  // ── Rateio específico da despesa (override do padrão da família) ──
  const definirRateio = async (t: Transaction) => {
    setRatear(t)
    setRateio(null)
    setRateioErro(undefined)
    try {
      const r = await getRateioTransacao(t.id)
      setRateio(r)
      setRateioModo(r.modo ?? 1)
      setPercentuais(Object.fromEntries(
        r.membros.map((m) => [m.usuarioId, m.percentual ? String(m.percentual) : ""])))
    } catch {
      notify({ open: true, message: "Defina a despesa como compartilhada antes de ratear", severity: "error" })
      setRatear(null)
    }
  }

  const handleSalvarRateio = async () => {
    if (!ratear) return
    let itens = null
    if (rateioModo === 3) {
      itens = (rateio?.membros ?? []).map((m) => ({
        usuarioId: m.usuarioId,
        percentual: Number(percentuais[m.usuarioId] ?? 0),
      }))
      const soma = itens.reduce((s, i) => s + i.percentual, 0)
      // Validação inline (nunca toast pra campo): bloqueia submit e marca os campos.
      if (Math.abs(soma - 100) > 0.01) {
        setRateioErro("Os percentuais devem somar 100%")
        return
      }
    }
    try {
      await definirRateioTransacao(ratear.id, rateioModo, itens)
      notify({ open: true, message: "Rateio definido", severity: "success" })
      setRatear(null)
      onMudou?.()
    } catch {
      notify({ open: true, message: "Erro ao definir rateio", severity: "error" })
    }
  }

  const handleRemoverRateio = async () => {
    if (!ratear) return
    try {
      await removerRateioTransacao(ratear.id)
      notify({ open: true, message: "Override de rateio removido", severity: "success" })
      setRatear(null)
      onMudou?.()
    } catch {
      notify({ open: true, message: "Erro ao remover rateio", severity: "error" })
    }
  }

  const modais = (
    <>
      {/* Compartilhar com família */}
      <PontesModal
        open={sharing !== null}
        title="Compartilhar com a família"
        onClose={() => setSharing(null)}
        footer={<PontesButton variant="outline" onClick={() => setSharing(null)}>Cancelar</PontesButton>}
      >
        {familias.length === 0 ? (
          <div className={styles.modalMuted}>Você não participa de nenhuma família.</div>
        ) : (
          <>
            <p className={styles.modalIntro}>Em qual família lançar “{sharing?.descricao}”?</p>
            <div className={styles.optionList}>
              {familias.map((f) => (
                <PontesButton key={f.id} variant="outline" fullWidth onClick={() => handleShare(f.id)}>{f.nome}</PontesButton>
              ))}
            </div>
          </>
        )}
      </PontesModal>

      {/* Atribuir a dependente */}
      <PontesModal
        open={assigning !== null}
        title="Atribuir a um dependente"
        onClose={() => setAssigning(null)}
        footer={<>
          <PontesButton variant="outline" onClick={() => handleAssign(null)}>Remover atribuição</PontesButton>
          <PontesButton variant="outline" onClick={() => setAssigning(null)}>Cancelar</PontesButton>
        </>}
      >
        {dependentes.length === 0 ? (
          <div className={styles.modalMuted}>Nenhum dependente cadastrado nas suas famílias.</div>
        ) : (
          <>
            <p className={styles.modalIntro}>A quem atribuir “{assigning?.descricao}”?</p>
            <div className={styles.optionList}>
              {dependentes.map((d) => (
                <PontesButton key={d.id} variant="outline" fullWidth onClick={() => handleAssign(d.id)}>
                  {d.nome}{d.apelido ? ` (${d.apelido})` : ""}
                </PontesButton>
              ))}
            </div>
          </>
        )}
      </PontesModal>

      {/* Rateio específico da despesa */}
      <PontesModal
        open={ratear !== null}
        title={`Rateio de “${ratear?.descricao ?? ""}”`}
        onClose={() => setRatear(null)}
        footer={<>
          <PontesButton variant="outline" onClick={handleRemoverRateio}>Remover override</PontesButton>
          <PontesButton variant="outline" onClick={() => setRatear(null)}>Cancelar</PontesButton>
          <PontesButton onClick={handleSalvarRateio}>Salvar</PontesButton>
        </>}
      >
        <p className={styles.modalIntro}>Define o modo de rateio só para esta despesa, sobrepondo o padrão da família.</p>
        <PontesField label="Modo">
          <PontesSelect
            value={String(rateioModo)}
            onChange={(v) => setRateioModo(Number(v) as ModoRateio)}
            options={MODOS_RATEIO}
          />
        </PontesField>
        {rateioModo === 3 && (rateio?.membros ?? []).map((m) => (
          <PontesField key={m.usuarioId} label={`${m.nome} (%)`}>
            <PontesInput
              type="number"
              value={percentuais[m.usuarioId] ?? ""}
              onChange={(e) => { setRateioErro(undefined); setPercentuais((p) => ({ ...p, [m.usuarioId]: e.target.value })) }}
              min={0} max={100} step="0.01"
              invalid={!!rateioErro}
            />
          </PontesField>
        ))}
        {rateioErro && <p className={styles.rateioErro}>{rateioErro}</p>}
      </PontesModal>
    </>
  )

  return { compartilhar, atribuir, definirRateio, modais }
}
