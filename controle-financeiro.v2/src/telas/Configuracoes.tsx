// Configurações do v2 — separadas por assunto, como a Conta do Google: menu de seções à esquerda (`?s=`), o
// conteúdo da seção à direita. Segurança e login (senha, verificação em duas etapas, sessões, dispositivos
// confiáveis) · Perfil · Aparência · Dados e privacidade. O que ainda não foi transformado (editar perfil,
// baixar/excluir a conta) leva pro app atual.
import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { ArrowUpRight, FileLock2, Moon, Palette, ShieldCheck, Sun, UserRound } from "lucide-react"
import { Link } from "react-router-dom"
import { APP_ATUAL } from "../config"
import { useAuth } from "../auth/useAuth"
import { useTema, type Tema } from "../layout/useTema"
import Bloco from "../componentes/Bloco"
import NavSecoes, { type Secao } from "../componentes/NavSecoes"
import Segmentos from "../componentes/Segmentos"
import SegurancaMfa from "./SegurancaMfa"
import SegurancaDispositivos from "./SegurancaDispositivos"
import TrocarSenha from "./TrocarSenha"
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
    <div className={styles.pagina}>
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

function Perfil() {
  const { usuario } = useAuth()
  return (
    <Bloco titulo="Seus dados">
      <dl className={styles.dados}>
        <div><dt>Nome</dt><dd>{usuario?.nome ?? "—"}</dd></div>
        <div><dt>E-mail</dt><dd>{usuario?.email ?? "—"}</dd></div>
      </dl>
      <NoAppAtual texto="Editar o nome e a data de nascimento ainda é no app atual." caminho="/settings" />
    </Bloco>
  )
}

function Aparencia() {
  const [tema, definirTema] = useTema()
  return (
    <Bloco titulo="Tema">
      <div className={styles.opcao}>
        <span className={styles.rotulo}>Cores do app neste aparelho</span>
        <Segmentos<Tema> ariaLabel="Tema" valor={tema} onChange={definirTema} opcoes={[
          { valor: "claro", rotulo: "Claro", icone: <Sun size={14} strokeWidth={2.25} aria-hidden="true" /> },
          { valor: "escuro", rotulo: "Escuro", icone: <Moon size={14} strokeWidth={2.25} aria-hidden="true" /> },
        ]} />
      </div>
    </Bloco>
  )
}

function Privacidade() {
  return (
    <>
      <Bloco titulo="Documentos">
        <ul className={styles.links}>
          <li><Link to="/privacidade" target="_blank" rel="noreferrer">Política de Privacidade <ArrowUpRight size={14} strokeWidth={2.25} aria-hidden="true" /></Link></li>
          <li><Link to="/termos-de-uso" target="_blank" rel="noreferrer">Termos de Uso <ArrowUpRight size={14} strokeWidth={2.25} aria-hidden="true" /></Link></li>
        </ul>
      </Bloco>
      <Bloco titulo="Seus dados">
        <NoAppAtual texto="Baixar uma cópia dos seus dados e excluir a conta ainda é no app atual." caminho="/settings" />
      </Bloco>
    </>
  )
}

function NoAppAtual({ texto, caminho }: { texto: string; caminho: string }) {
  return (
    <div className={styles.noAppAtual}>
      <p className={styles.texto}>{texto}</p>
      <a href={`${APP_ATUAL}${caminho}`} className={styles.link}>Abrir no app atual <ArrowUpRight size={14} strokeWidth={2.25} aria-hidden="true" /></a>
    </div>
  )
}
