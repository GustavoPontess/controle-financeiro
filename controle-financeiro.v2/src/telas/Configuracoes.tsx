// Configurações do v2: aparência (tema claro/escuro, lembrado no dispositivo) e verificação em duas etapas.
// Perfil, senha, dispositivos e exclusão ainda estão no app atual — o link leva lá até serem transformados.
import { ArrowUpRight, Moon, Sun } from "lucide-react"
import { APP_ATUAL } from "../config"
import { useTema, type Tema } from "../layout/useTema"
import Bloco from "../componentes/Bloco"
import Segmentos from "../componentes/Segmentos"
import SegurancaMfa from "./SegurancaMfa"
import styles from "./Configuracoes.module.css"

export default function Configuracoes() {
  const [tema, definirTema] = useTema()
  return (
    <div className={styles.pagina}>
      <div className={styles.principal}>
        <SegurancaMfa />
      </div>
      <div className={styles.lado}>
        <Bloco titulo="Aparência">
          <div className={styles.opcao}>
            <span className={styles.rotulo}>Tema</span>
            <Segmentos<Tema> ariaLabel="Tema" valor={tema} onChange={definirTema} opcoes={[
              { valor: "claro", rotulo: "Claro", icone: <Sun size={14} strokeWidth={2.25} aria-hidden="true" /> },
              { valor: "escuro", rotulo: "Escuro", icone: <Moon size={14} strokeWidth={2.25} aria-hidden="true" /> },
            ]} />
          </div>
        </Bloco>

        <Bloco titulo="Conta">
          <p className={styles.texto}>Perfil, senha, dispositivos e exclusão da conta ainda ficam no app atual.</p>
          <a href={`${APP_ATUAL}/settings`} className={styles.link}>Abrir no app atual <ArrowUpRight size={14} strokeWidth={2.25} aria-hidden="true" /></a>
        </Bloco>
      </div>
    </div>
  )
}
