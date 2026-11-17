// Configurações do v2 — separadas por assunto, como a Conta do Google: menu de seções à esquerda (`?s=`), o
// conteúdo da seção à direita. No celular, primeiro só o menu; tocou numa seção, só ela (a seta do topo volta). Segurança e login (senha, verificação em duas etapas, sessões, dispositivos
// confiáveis) · Perfil (nome e nascimento) · Aparência · Dados e privacidade (baixar os dados, excluir a conta).
import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { ArrowUpRight, CheckCircle2, Download, FileLock2, Moon, Palette, ShieldCheck, Sun, UserRound } from "lucide-react"
import { Link } from "react-router-dom"
import { useTema, type Tema } from "../layout/useTema"
import Bloco from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import { propsDeLinkInterno, useInstalar } from "../pwa/instalar"
import NavSecoes, { type Secao } from "../componentes/NavSecoes"
import Segmentos from "../componentes/Segmentos"
import SegurancaMfa from "./SegurancaMfa"
import SegurancaDispositivos from "./SegurancaDispositivos"
import TrocarSenha from "./TrocarSenha"
import Perfil from "./Perfil"
import DadosConta from "./DadosConta"
import styles from "./Configuracoes.module.css"

type IdSecao = "seguranca" | "perfil" | "aparencia" | "privacidade"
const SECOES: Secao<IdSecao>[] = [
  { id: "seguranca", rotulo: "Segurança e login", icone: ShieldCheck },
  { id: "perfil", rotulo: "Perfil", icone: UserRound },
  { id: "aparencia", rotulo: "Aparência", icone: Palette },
  { id: "privacidade", rotulo: "Dados e privacidade", icone: FileLock2 },
]

export default function Configuracoes() {
  const [params] = useSearchParams()
  const pedida = params.get("s") as IdSecao | null
  const ativa = SECOES.find((s) => s.id === pedida) ?? SECOES[0]

  return (
    <div className={styles.pagina} data-escolhida={pedida ? "sim" : undefined}>
      <aside className={styles.menu}>
        <NavSecoes secoes={SECOES} ativa={ativa.id} ariaLabel="Seções das configurações" />
      </aside>
      <section className={styles.conteudo} aria-labelledby="secao-titulo">
        <h2 id="secao-titulo" className={styles.titulo}>{ativa.rotulo}</h2>
        {ativa.id === "seguranca" && <Seguranca />}
        {ativa.id === "perfil" && <Perfil />}
        {ativa.id === "aparencia" && <Aparencia />}
        {ativa.id === "privacidade" && <Privacidade />}
      </section>
    </div>
  )
}

function Seguranca() {
  // Trocar a senha pode encerrar as outras sessões: a lista recarrega.
  const [versao, setVersao] = useState(0)
  return (
    <>
      <TrocarSenha aoTrocar={() => setVersao((v) => v + 1)} />
      <SegurancaMfa />
      <SegurancaDispositivos key={versao} />
    </>
  )
}

function Aparencia() {
  const [tema, definirTema] = useTema()
  return (
    <>
    <Bloco titulo="Tema">
      <div className={styles.opcao}>
        <span className={styles.rotulo}>Cores do app neste aparelho</span>
        <Segmentos<Tema> ariaLabel="Tema" valor={tema} onChange={definirTema} opcoes={[
          { valor: "claro", rotulo: "Claro", icone: <Sun size={14} strokeWidth={2.25} aria-hidden="true" /> },
          { valor: "escuro", rotulo: "Escuro", icone: <Moon size={14} strokeWidth={2.25} aria-hidden="true" /> },
        ]} />
      </div>
    </Bloco>
    <AppNoAparelho />
    </>
  )
}

// Instalar como app (PWA, 2026-11-17): abre em tela cheia, sem a barra de endereço e os menus do navegador.
function AppNoAparelho() {
  const [jeito, instalar] = useInstalar()
  return (
    <Bloco titulo="App no aparelho">
      <div className={styles.opcao}>
        {jeito === "instalado" && (
          <span className={styles.rotulo}><CheckCircle2 size={16} strokeWidth={2.25} aria-hidden="true" className={styles.instalado} /> Instalado neste aparelho</span>
        )}
        {jeito === "botao" && <>
          <span className={styles.rotulo}>Abrir o Pontes como app, em tela cheia</span>
          <Botao variante="primario" icone={<Download size={16} strokeWidth={2.25} aria-hidden="true" />} onClick={() => void instalar()}>Instalar</Botao>
        </>}
        {jeito === "iphone" && (
          <span className={styles.rotulo}>No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início, com Abrir como App Web ligado.</span>
        )}
        {jeito === "menu" && (
          <span className={styles.rotulo}>No menu do navegador, escolha Instalar app ou Adicionar à tela inicial.</span>
        )}
      </div>
    </Bloco>
  )
}

function Privacidade() {
  return (
    <>
      <Bloco titulo="Documentos">
        <ul className={styles.links}>
          <li><Link to="/privacidade" {...propsDeLinkInterno()}>Política de Privacidade <ArrowUpRight size={14} strokeWidth={2.25} aria-hidden="true" /></Link></li>
          <li><Link to="/termos-de-uso" {...propsDeLinkInterno()}>Termos de Uso <ArrowUpRight size={14} strokeWidth={2.25} aria-hidden="true" /></Link></li>
        </ul>
      </Bloco>
      <DadosConta />
    </>
  )
}
