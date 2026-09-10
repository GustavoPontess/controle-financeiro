import { useEffect, useState } from "react"
import { PontesStatCard, PontesSkeleton } from "@/components/pontes"
import adminService from "@/services/adminService"
import type { MetricasAdmin } from "@/types/Admin"
import styles from "./AdminPage.module.css"

/** Métricas do beta (item "Métricas" da lateral do admin). Acesso já garantido pelo AdminRoute. */
export default function AdminMetricasPage() {
  const [metricas, setMetricas] = useState<MetricasAdmin | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    adminService.metricas()
      .then((m) => { if (vivo) setMetricas(m) })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [])

  return (
    <div className={styles.wrap}>
      <p className={styles.sub}>Visão geral dos cadastros do beta por situação.</p>

      {carregando || !metricas ? (
        <PontesSkeleton height={120} />
      ) : (
        <div className={styles.metricas}>
          <PontesStatCard label="Total de cadastros" value={String(metricas.total)} />
          <PontesStatCard label="Aguardando aprovação" value={String(metricas.pendentes)} tone="warning" hint="na fila agora" />
          <PontesStatCard label="Ativos" value={String(metricas.ativos)} tone="success" />
          <PontesStatCard label="Recusados" value={String(metricas.recusados)} />
          <PontesStatCard label="Bloqueados" value={String(metricas.bloqueados)} tone="danger" />
          <PontesStatCard label="Cadastros (7 dias)" value={String(metricas.cadastrosUltimos7Dias)} hint="inclui hoje" />
          <PontesStatCard label="Ativos que acessaram (7 dias)" value={String(metricas.ativosUltimos7Dias)} tone="success" />
        </div>
      )}
    </div>
  )
}
