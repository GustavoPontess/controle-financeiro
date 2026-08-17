// Peças reaproveitadas pelas 3 páginas de bancada — mesmo cluster de badges de status e mesmos
// ícones de ação da tela real, ligados no hook compartilhado (ações mexem no dado de verdade).
import { AlertCircle, Receipt, Handshake, History, ChevronDown, Trash2, Link2, Check, X, Archive, ArchiveRestore } from "lucide-react"
import { PontesBadge, PontesIconButton } from "@/components/pontes"
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

/** Mesmos ícones de ação da tela real (Ver parcelas/Registrar/Quitar/Histórico/Vincular/Arquivar/Remover),
 * ligados no MESMO hook — clicar aqui mexe no dado de verdade, com as mesmas confirmações de sempre. */
export function ActionIcons({ e, size = 32, logic, className }: {
  e: Emprestimo; size?: 24 | 32; logic: EmprestimosLogic; className?: string
}) {
  const isParcelado = e.formaPagamento === FormaPagamentoEmprestimo.Parcelado
  return (
    <div className={className}>
      {isParcelado && (
        <PontesIconButton size={size} variant="ghost" aria-label={logic.expandedId === e.id ? "Recolher parcelas" : "Ver parcelas"}
          onClick={() => void logic.toggleExpand(e.id)}>
          <ChevronDown size={14} />
        </PontesIconButton>
      )}
      {!e.quitado && (
        <PontesIconButton size={size} variant="ghost" aria-label="Registrar pagamento" onClick={() => logic.openSolicitar(e.id)}>
          <Receipt size={14} />
        </PontesIconButton>
      )}
      {!e.quitado && e.souCredor && (
        <PontesIconButton size={size} variant="ghost" aria-label="Marcar como quitado" onClick={() => logic.setQuitarId(e.id)}>
          <Handshake size={14} />
        </PontesIconButton>
      )}
      {e.statusVinculo === StatusVinculoEmprestimo.Vinculado && (
        <PontesIconButton size={size} variant="ghost" aria-label="Ver histórico de pagamentos" onClick={() => logic.openHistorico(e.id)}>
          <History size={14} />
        </PontesIconButton>
      )}
      {(e.statusVinculo === StatusVinculoEmprestimo.SemVinculo || e.statusVinculo === StatusVinculoEmprestimo.Recusado) && (
        <PontesIconButton size={size} variant="ghost" aria-label="Vincular a uma pessoa" onClick={() => logic.openVincular(e.id)}>
          <Link2 size={14} />
        </PontesIconButton>
      )}
      {e.quitado && !e.arquivado && (
        <PontesIconButton size={size} variant="ghost" aria-label="Arquivar" onClick={() => void logic.handleArquivar(e.id)} disabled={logic.arquivandoId === e.id}>
          <Archive size={14} />
        </PontesIconButton>
      )}
      {e.quitado && e.arquivado && (
        <PontesIconButton size={size} variant="ghost" aria-label="Desarquivar" onClick={() => void logic.handleDesarquivar(e.id)} disabled={logic.arquivandoId === e.id}>
          <ArchiveRestore size={14} />
        </PontesIconButton>
      )}
      <PontesIconButton size={size} variant="ghost" aria-label="Remover" onClick={() => logic.setDelId(e.id)}>
        <Trash2 size={14} />
      </PontesIconButton>
    </div>
  )
}

/** Aceitar/Recusar convite ou consolidação — mesmo par de ícones nos 2 banners da tela real. */
export function AcaoDupla({ onAceitar, onRecusar, disabled }: { onAceitar: () => void; onRecusar: () => void; disabled?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <PontesIconButton size={32} variant="ghost" aria-label="Aceitar" disabled={disabled} onClick={onAceitar}>
        <Check size={14} />
      </PontesIconButton>
      <PontesIconButton size={32} variant="ghost" aria-label="Recusar" disabled={disabled} onClick={onRecusar}>
        <X size={14} />
      </PontesIconButton>
    </div>
  )
}
