// Onde o lançamento aconteceu (2026-11-07): "Usar onde estou" pede o ponto ao APARELHO (o navegador pergunta à pessoa
// antes) e mostra o ponto com "ver no mapa" (abre o OpenStreetMap numa aba nova, só se a pessoa clicar) e o X pra tirar.
// Escrito como texto, no jeito do nome editável da ficha: a caixa só aparece no hover e no foco.
import { useState } from "react"
import { MapPin, X } from "lucide-react"
import type { Ponto } from "../types/Transaction"
import { linkDoMapa, textoDoPonto } from "../dominio/anexo"
import styles from "./Localizacao.module.css"

export default function Localizacao({ valor, onChange, desabilitado }: {
  valor: Ponto | null
  /** Pode ser assíncrono (grava no servidor); se lançar, a mensagem aparece embaixo. Sem ele: só mostra. */
  onChange?: (ponto: Ponto | null) => void | Promise<void>
  desabilitado?: boolean
}) {
  const [pegando, setPegando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const aplicar = async (p: Ponto | null) => {
    try { await onChange?.(p) } catch { setErro("Não deu pra salvar a localização. Tente de novo.") }
  }

  const pegar = () => {
    setErro(null)
    if (!("geolocation" in navigator)) { setErro("Este aparelho não informa a localização."); return }
    setPegando(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await aplicar({ latitude: Number(pos.coords.latitude.toFixed(4)), longitude: Number(pos.coords.longitude.toFixed(4)) })
        setPegando(false)
      },
      (e) => {
        setPegando(false)
        setErro(e.code === e.PERMISSION_DENIED
          ? "O navegador não deixou pegar a localização. Libere nas permissões do site."
          : "Não deu pra pegar a localização agora.")
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 })
  }

  return (
    <span className={styles.raiz}>
      {valor
        ? <span className={styles.ponto}>
            <a className={styles.mapa} href={linkDoMapa(valor)} target="_blank" rel="noopener noreferrer" title="Ver no mapa">
              <MapPin size={16} strokeWidth={2.25} aria-hidden="true" />
              <span className={styles.texto}>{textoDoPonto(valor)}</span>
            </a>
            {onChange && (
              <button type="button" className={styles.tirar} aria-label="Tirar localização" title="Tirar localização"
                disabled={desabilitado} onClick={() => { setErro(null); void aplicar(null) }}>
                <X size={16} strokeWidth={2.25} aria-hidden="true" />
              </button>
            )}
          </span>
        : <button type="button" className={styles.acao} disabled={desabilitado || pegando} onClick={pegar}>
            <span>{pegando ? "Pegando a localização…" : "Usar onde estou"}</span>
            <MapPin size={16} strokeWidth={2.25} aria-hidden="true" className={styles.icone} />
          </button>}
      {erro && <span className={styles.erro} role="alert">{erro}</span>}
    </span>
  )
}
