import { Check } from "lucide-react"
import { palettes, fonts, usePontesTheme } from "@/components/pontes"
import styles from "./SettingsPage.module.css"

/**
 * #90 — Personalização in-app.
 * Picker de paleta + fonte. Lê/grava via PontesThemeProvider (localStorage).
 * Mudança é live em todas as telas + sobrevive reload.
 */
export default function SettingsPage() {
  const { paletteId, fontId, setPaletteId, setFontId } = usePontesTheme()

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <h1 className={styles.title}>Configurações</h1>
        <p className={styles.subtitle}>
          Personalize a aparência do app. As escolhas valem em todas as telas e sobrevivem ao reload.
        </p>
      </header>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Paleta de cores</h2>
          <p className={styles.sectionHint}>15 combinações curadas. Clique pra trocar — vale em tudo na hora.</p>
        </div>
        <div className={styles.paletteGrid}>
          {palettes.map((p) => {
            const selected = p.id === paletteId
            return (
              <button
                key={p.id}
                type="button"
                className={styles.paletteCard}
                data-selected={selected ? "true" : undefined}
                onClick={() => setPaletteId(p.id)}
                aria-pressed={selected}
              >
                <div className={styles.swatches}>
                  <span style={{ background: p.primary }} aria-hidden="true" />
                  <span style={{ background: p.accent }} aria-hidden="true" />
                </div>
                <div className={styles.paletteMeta}>
                  <span className={styles.paletteLabel}>{p.label}</span>
                  <span className={styles.paletteDesc}>{p.description}</span>
                </div>
                {selected && <Check size={16} strokeWidth={2.5} className={styles.checkIcon} aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Fonte</h2>
          <p className={styles.sectionHint}>7 famílias. Wordmark "Pontes" mantém Plus Jakarta (marca fixa).</p>
        </div>
        <div className={styles.fontGrid}>
          {fonts.map((f) => {
            const selected = f.id === fontId
            return (
              <button
                key={f.id}
                type="button"
                className={styles.fontCard}
                data-selected={selected ? "true" : undefined}
                onClick={() => setFontId(f.id)}
                aria-pressed={selected}
                style={{ fontFamily: f.family }}
              >
                <span className={styles.fontPreview}>Aa</span>
                <div className={styles.fontMeta}>
                  <span className={styles.fontLabel}>{f.label}</span>
                  <span className={styles.fontDesc}>{f.description}</span>
                </div>
                {selected && <Check size={16} strokeWidth={2.5} className={styles.checkIcon} aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
