// Rosto de alguém: a foto de perfil quando existe, senão o texto (inicial ou iniciais). O tamanho e a cor
// vêm da classe de quem usa (a bolinha da lista, o avatar do menu); aqui só troca o miolo. Se a foto não
// carregar (sem permissão, removida), volta pro texto sem quebrar a linha.
import { useState } from "react"
import styles from "./Avatar.module.css"

/** URL da foto de perfil, com a versão (o navegador só busca de novo quando a pessoa troca). */
export function urlFoto(usuarioId: string | undefined, fotoEm: string | null | undefined): string | undefined {
  if (!usuarioId || !fotoEm) return undefined
  return `/api/v1/usuarios/${usuarioId}/foto?v=${encodeURIComponent(fotoEm)}`
}

export default function Avatar({ foto, texto, className, destaque }: {
  foto?: string
  texto: string
  className?: string
  destaque?: boolean
}) {
  const [falhou, setFalhou] = useState<string | null>(null)
  const comFoto = !!foto && falhou !== foto
  return (
    <span className={`${styles.avatar} ${className ?? ""}`} data-destaque={destaque || undefined} data-foto={comFoto || undefined} aria-hidden="true">
      {comFoto ? <img src={foto} alt="" className={styles.img} draggable={false} onError={() => setFalhou(foto)} /> : texto}
    </span>
  )
}
