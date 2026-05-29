import { Settings as SettingsIcon } from "lucide-react"
import { PontesEmptyState } from "@/components/pontes"
import styles from "./SettingsPage.module.css"

export default function SettingsPage() {
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <h1 className={styles.title}>Configurações</h1>
        <p className={styles.subtitle}>
          Gerencie as preferências da sua conta e visualize informações sobre seus dados.
        </p>
      </header>

      <PontesEmptyState
        icon={<SettingsIcon size={28} />}
        title="Mais configurações em breve"
        description="Estamos preparando opções de personalização (paleta, fonte, modo escuro), notificações e privacidade."
      />
    </div>
  )
}
