// Peças reaproveitadas pelas 3 páginas de bancada — mesmo cluster de badges de status e mesmos
// ícones de ação da tela real, ligados no hook compartilhado (ações mexem no dado de verdade).
import { AlertCircle, Receipt, Handshake, History, ChevronDown, Trash2, Link2, Check, X, Archive, ArchiveRestore, MoreVertical } from "lucide-react"
import { PontesBadge, PontesIconButton, PontesPopover, type PontesPopoverItem } from "@/components/pontes"
import { StatusVinculoEmprestimo, FormaPagamentoEmprestimo, type Emprestimo } from "../../types/Emprestimo"
import type { EmprestimosLogic } from "./useEmprestimosLogic"

export function StatusBadges({ e }: { e: Emprestimo }) {
  return (
    <>
      {e.quitado && <PontesBadge tone="success" size="sm">Quitado</PontesBadge>}
      {e.vencido && !e.quitado && <PontesBadge tone="danger" size="sm">Vencido</PontesBadge>}
      {e.statusVinculo === StatusVinculoEmprestimo.Vinculado && (
        <PontesBadge tone="success" size="sm">Vinculado</PontesBadge>
      )}
      {e.statusVinculo === StatusVinculoEmprestimo.PendenteAceite && (
        <PontesBadge tone="warning" size="sm">Convite pendente</PontesBadge>
      )}
      {e.souCredor && !e.quitado && e.valorPendente > 0 && (
        <PontesBadge tone="warning" size="sm"><AlertCircle size={12} /> Aguardando sua aprovação</PontesBadge>
      )}
    </>
  )
}

/** Mesmas ações da tela real (Ver parcelas/Registrar/Quitar/Histórico/Vincular/Arquivar/Remover),
 * agora num menu kebab (⋮) — ligado no MESMO hook, com as mesmas confirmações de sempre. */
export function ActionIcons({ e, size = 32, logic, className, mode = "full" }: {
  e: Emprestimo; size?: 24 | 32; logic: EmprestimosLogic; className?: string
  /** "full" (padrão): todas as ações. "management": só arquivar/desarquivar/remover — pra lista
   *  enxuta, onde as ações ricas (registrar/quitar/vincular/histórico) vivem na tela de detalhe. */
  mode?: "full" | "management"
}) {
  const isParcelado = e.formaPagamento === FormaPagamentoEmprestimo.Parcelado
  const semVinculo = e.statusVinculo === StatusVinculoEmprestimo.SemVinculo || e.statusVinculo === StatusVinculoEmprestimo.Recusado

  const aberto = logic.expandedId === e.id
  const full = mode === "full"
  const items: PontesPopoverItem[] = [
    full && {
      key: "detalhe", icon: <ChevronDown size={16} />,
      // Parcelado abre as parcelas; à vista abre o detalhe (pago/atrasado/vencido).
      label: isParcelado
        ? (aberto ? "Recolher parcelas" : "Ver parcelas")
        : (aberto ? "Recolher detalhe" : "Ver detalhe"),
      onClick: () => void logic.toggleExpand(e.id),
    },
    full && !e.quitado && {
      key: "registrar", icon: <Receipt size={16} />, label: "Registrar pagamento",
      onClick: () => logic.openSolicitar(e.id),
    },
    full && !e.quitado && e.souCredor && {
      key: "quitar", icon: <Handshake size={16} />, label: "Marcar como quitado",
      onClick: () => logic.setQuitarId(e.id),
    },
    full && e.statusVinculo === StatusVinculoEmprestimo.Vinculado && {
      key: "historico", icon: <History size={16} />, label: "Ver histórico de pagamentos",
      onClick: () => logic.openHistorico(e.id),
    },
    full && semVinculo && {
      key: "vincular", icon: <Link2 size={16} />, label: "Vincular a uma pessoa",
      onClick: () => logic.openVincular(e.id),
    },
    e.quitado && !e.arquivado && {
      key: "arquivar", icon: <Archive size={16} />, label: "Arquivar",
      onClick: () => void logic.handleArquivar(e.id),
    },
    e.quitado && e.arquivado && {
      key: "desarquivar", icon: <ArchiveRestore size={16} />, label: "Desarquivar",
      onClick: () => void logic.handleDesarquivar(e.id),
    },
    {
      key: "remover", icon: <Trash2 size={16} />, label: "Remover", danger: true, divider: true,
      onClick: () => logic.setDelId(e.id),
    },
  ].filter(Boolean) as PontesPopoverItem[]

  return (
    <div className={className}>
      <PontesPopover
        align="right"
        minWidth={210}
        trigger={
          <PontesIconButton size={size} variant="ghost" aria-label="Ações">
            <MoreVertical size={16} />
          </PontesIconButton>
        }
        items={items}
      />
    </div>
  )
}

/** Aceitar/Recusar convite ou consolidação — mesmo par de ícones nos 2 banners da tela real. */
export function AcaoDupla({ onAceitar, onRecusar, disabled }: { onAceitar: () => void; onRecusar: () => void; disabled?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <PontesIconButton size={32} variant="ghost" aria-label="Aceitar" disabled={disabled} onClick={onAceitar}>
        <Check size={16} />
      </PontesIconButton>
      <PontesIconButton size={32} variant="ghost" aria-label="Recusar" disabled={disabled} onClick={onRecusar}>
        <X size={16} />
      </PontesIconButton>
    </div>
  )
}
