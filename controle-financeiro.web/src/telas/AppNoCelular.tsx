// Configurações › App no celular (2026-11-17, pedido do Gustavo: "menu próprio pra isso"). Instalar o Pontes como app
// (abre em tela cheia, sem a barra do navegador). Android/computador: botão Instalar
// (o navegador deixa). iPhone: a Apple não deixa site ter botão; o passo a passo mostra os ícones do Safari.
import { useState, type ReactNode } from "react"
import { CheckCircle2, Download, EllipsisVertical, Share, SquarePlus } from "lucide-react"
import Bloco from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import { useInstalar, type JeitoDeInstalar } from "../pwa/instalar"
import { BarraDev, useEstadoDev } from "../dev/BarraDev"
import styles from "./AppNoCelular.module.css"

const ICONE = { size: 16, strokeWidth: 2.25, "aria-hidden": true } as const

export default function AppNoCelular() {
  const [jeitoReal, instalar] = useInstalar()
  // DEV: ver cada jeito sem ter o aparelho (#iphone, #botao, #menu, #instalado).
  const [jeitoDev, setJeitoDev] = useState<JeitoDeInstalar | null>(null)
  useEstadoDev(import.meta.env.DEV ? (e) => setJeitoDev(e as JeitoDeInstalar) : undefined)
  const jeito = jeitoDev ?? jeitoReal

  return (
    <>
      <Bloco titulo="Instalar">
        {jeito === "instalado" && (
          <p className={styles.instalado}><CheckCircle2 {...ICONE} /> Instalado neste aparelho</p>
        )}
        {jeito === "botao" && (
          <div className={styles.linha}>
            <span className={styles.texto}>Abrir o Pontes como app, em tela cheia</span>
            <Botao variante="primario" icone={<Download {...ICONE} />} onClick={() => void instalar()}>Instalar</Botao>
          </div>
        )}
        {jeito === "iphone" && (
          <Passos>
            <Passo n={1}>No Safari, toque em <Chip icone={<Share {...ICONE} />}>Compartilhar</Chip></Passo>
            <Passo n={2}>Escolha <Chip icone={<SquarePlus {...ICONE} />}>Adicionar à Tela de Início</Chip></Passo>
            <Passo n={3}>Toque em <Chip>Adicionar</Chip> e abra o Pontes pelo ícone</Passo>
          </Passos>
        )}
        {jeito === "menu" && (
          <Passos>
            <Passo n={1}>Abra o menu do navegador <Chip icone={<EllipsisVertical {...ICONE} />}>Menu</Chip></Passo>
            <Passo n={2}>Escolha <Chip icone={<Download {...ICONE} />}>Instalar app</Chip> ou <Chip icone={<SquarePlus {...ICONE} />}>Adicionar à tela inicial</Chip></Passo>
            <Passo n={3}>Abra o Pontes pelo ícone</Passo>
          </Passos>
        )}
      </Bloco>
      {import.meta.env.DEV && <BarraDev atual={jeito} grupos={[{ grupo: "Instalar", estados: [
        { rotulo: "iPhone", para: "/configuracoes?s=app#iphone" },
        { rotulo: "Botão (Android)", para: "/configuracoes?s=app#botao" },
        { rotulo: "Menu do navegador", para: "/configuracoes?s=app#menu" },
        { rotulo: "Instalado", para: "/configuracoes?s=app#instalado" },
      ] }]} />}
    </>
  )
}

function Passos({ children }: { children: ReactNode }) {
  return <ol className={styles.passos}>{children}</ol>
}

function Passo({ n, children }: { n: number; children: ReactNode }) {
  return <li className={styles.passo}><span className={styles.numero} aria-hidden="true">{n}</span><span className={styles.texto}>{children}</span></li>
}

/** O botão do navegador como aparece lá (ícone + nome), pra pessoa achar. */
function Chip({ icone, children }: { icone?: ReactNode; children: ReactNode }) {
  return <span className={styles.chip}>{icone}{children}</span>
}
