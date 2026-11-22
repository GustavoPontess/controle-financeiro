// Logo do banco (ou iniciais na cor da marca). A cor vem do dado — inline de propósito (valor de runtime).
import { useState } from "react"
import styles from "./LogoMarca.module.css"

function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/)
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase()
}

export default function LogoMarca({ nome, logoUrl, cor, tamanho = 36, daCasa }: {
  nome: string; logoUrl?: string | null; cor?: string | null; tamanho?: number
  /** Sem banco por trás (a carteira, o dinheiro em mãos): a marca é a do Pontes (o arquivo da logo, como ele é). */
  daCasa?: boolean
}) {
  const [quebrou, setQuebrou] = useState(false)
  if (daCasa && !logoUrl) {
    return (
      <span className={styles.marca} data-da-casa="true" style={{ width: tamanho, height: tamanho }}>
        <img src="/site/estaiada-laranja.svg" alt="" />
      </span>
    )
  }
  const fundo = cor && /^#?[0-9a-f]{3,8}$/i.test(cor) ? (cor.startsWith("#") ? cor : `#${cor}`) : undefined
  return (
    <span className={styles.marca} style={{ width: tamanho, height: tamanho, background: logoUrl && !quebrou ? undefined : fundo }} data-iniciais={!logoUrl || quebrou ? "true" : undefined}>
      {logoUrl && !quebrou
        ? <img src={logoUrl} alt="" width={tamanho} height={tamanho} onError={() => setQuebrou(true)} />
        : <span>{iniciais(nome)}</span>}
    </span>
  )
}
