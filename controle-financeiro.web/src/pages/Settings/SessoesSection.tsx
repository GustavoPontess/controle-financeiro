import { useEffect, useState } from "react"
import { Monitor, LogOut } from "lucide-react"
import {
  PontesButton, PontesBadge, PontesDialog, PontesSkeleton, PontesEmptyState,
} from "@/components/pontes"
import sessaoService from "@/services/sessaoService"
import type { Sessao } from "@/types/Sessao"
import styles from "./SessoesSection.module.css"

function formatarData(iso?: string | null): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso))
}

/** Resumo amigável do User-Agent (sem fingerprint): navegador · sistema. */
function resumirDispositivo(ua?: string | null): string {
  if (!ua) return "Dispositivo desconhecido"
  const nav = /Edg/i.test(ua) ? "Edge"
    : /Chrome/i.test(ua) ? "Chrome"
    : /Firefox/i.test(ua) ? "Firefox"
    : /Safari/i.test(ua) ? "Safari"
    : "Navegador"
  const os = /Windows/i.test(ua) ? "Windows"
    : /Android/i.test(ua) ? "Android"
    : /iPhone|iPad|iOS/i.test(ua) ? "iOS"
    : /Mac OS X|Macintosh/i.test(ua) ? "macOS"
    : /Linux/i.test(ua) ? "Linux"
    : ""
  return os ? `${nav} · ${os}` : nav
}

type Confirm = { tipo: "revogar"; sessao: Sessao } | { tipo: "outras" } | null

/**
 * Sessões ativas / dispositivos (multi-conta Fase 2). Lista onde a conta está logada, marca o
 * dispositivo atual e permite encerrar uma sessão ou "sair de todos os outros dispositivos".
 */
export default function SessoesSection() {
  const [sessoes, setSessoes] = useState<Sessao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [processando, setProcessando] = useState(false)
  const [confirm, setConfirm] = useState<Confirm>(null)

  const carregar = () => {
    setCarregando(true)
    sessaoService.listar()
      .then(setSessoes)
      .catch(() => { /* toast global cobre o erro */ })
      .finally(() => setCarregando(false))
  }
  useEffect(() => { carregar() }, [])

  const outras = sessoes.filter((s) => !s.atual).length

  const confirmar = async () => {
    if (!confirm) return
    const alvo = confirm
    setConfirm(null)
    setProcessando(true)
    try {
      if (alvo.tipo === "revogar") await sessaoService.revogar(alvo.sessao.id)
      else await sessaoService.revogarOutras()
      carregar()
    } catch {
      // toast global cobre
    } finally {
      setProcessando(false)
    }
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <p className={styles.eyebrow}>Segurança</p>
        <h2 className={styles.sectionTitle}>
          <Monitor size={18} strokeWidth={2.5} className={styles.sectionIcon} aria-hidden="true" />
          Sessões e dispositivos
        </h2>
        <p className={styles.sectionHint}>
          Onde sua conta está conectada. Encerre uma sessão que você não reconhece.
        </p>
      </div>

      {carregando ? (
        <PontesSkeleton height={140} />
      ) : sessoes.length === 0 ? (
        <PontesEmptyState title="Nenhuma sessão ativa" description="Não há dispositivos conectados nesta conta." />
      ) : (
        <>
          <ul className={styles.list}>
            {sessoes.map((s) => (
              <li key={s.id} className={styles.item}>
                <div className={styles.itemMain}>
                  <span className={styles.device}>{resumirDispositivo(s.dispositivo)}</span>
                  <span className={styles.meta}>
                    {s.ip ? `${s.ip} · ` : ""}último uso {formatarData(s.ultimoUsoEm ?? s.criadoEm)}
                  </span>
                </div>
                {s.atual ? (
                  <PontesBadge tone="success" size="sm">Este dispositivo</PontesBadge>
                ) : (
                  <PontesButton
                    variant="ghost"
                    size="sm"
                    disabled={processando}
                    onClick={() => setConfirm({ tipo: "revogar", sessao: s })}
                  >
                    Encerrar
                  </PontesButton>
                )}
              </li>
            ))}
          </ul>

          {outras > 0 && (
            <div className={styles.actions}>
              <PontesButton
                variant="outline"
                size="sm"
                loading={processando}
                onClick={() => setConfirm({ tipo: "outras" })}
              >
                <LogOut size={14} strokeWidth={2.5} /> Sair dos outros dispositivos
              </PontesButton>
            </div>
          )}
        </>
      )}

      <PontesDialog
        open={!!confirm}
        tone="danger"
        title={confirm?.tipo === "outras" ? "Sair dos outros dispositivos?" : "Encerrar esta sessão?"}
        description={
          confirm?.tipo === "outras"
            ? "Todas as outras sessões serão encerradas. Este dispositivo continua conectado."
            : "O dispositivo dessa sessão precisará entrar de novo."
        }
        confirmLabel={confirm?.tipo === "outras" ? "Sair dos outros" : "Encerrar"}
        cancelLabel="Cancelar"
        onConfirm={confirmar}
        onCancel={() => setConfirm(null)}
      />
    </section>
  )
}
