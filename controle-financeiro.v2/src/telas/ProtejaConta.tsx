// "Proteja sua conta" (/proteja-sua-conta): convite pra ativar a verificação em duas etapas, mostrado logo
// depois do login quando o MFA está desligado (o servidor decide — MfaStatus.mostrarConvite). Só convida,
// nunca obriga: "Ativar agora" abre o passo a passo aqui mesmo; "Agora não" volta a perguntar em 30 dias; com
// "Não perguntar mais" marcado, nunca mais. A resposta fica no servidor (vale em todo dispositivo).
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { KeyRound, ShieldCheck, Smartphone } from "lucide-react"
import Logo from "../componentes/Logo"
import Botao from "../componentes/Botao"
import mfaService from "../services/mfaService"
import SegurancaMfa from "./SegurancaMfa"
import styles from "./Auth.module.css"

const BENEFICIOS = [
  { icone: KeyRound, texto: "Mesmo que descubram sua senha, ninguém entra sem o código." },
  { icone: Smartphone, texto: "O código vem do app autenticador do seu celular. Leva 1 minuto pra configurar." },
  { icone: ShieldCheck, texto: "Neste dispositivo dá pra pular o código por 30 dias." },
]

export default function ProtejaConta() {
  const navigate = useNavigate()
  const [ativando, setAtivando] = useState(false)
  const [nuncaMais, setNuncaMais] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const irPraVisaoGeral = () => navigate("/dashboard", { replace: true })

  const agoraNao = async () => {
    setEnviando(true)
    // Se falhar, só não fica lembrado: o convite volta no próximo login. Nunca prende a pessoa aqui.
    try { await mfaService.responderConvite(nuncaMais) } catch { /* segue */ }
    irPraVisaoGeral()
  }

  return (
    <div className={`v2 ${styles.raiz}`}>
      <aside className={styles.palco}>
        <div className={styles.marca}><Logo size={28} /></div>
        <div className={styles.palcoMeio}>
          <p className={styles.frase}>Sua senha, <span className={styles.fraseSuave}>e mais uma tranca.</span></p>
          <p className={styles.lead}>Num app com o seu dinheiro, a verificação em duas etapas é a proteção que mais faz diferença.</p>
        </div>
        <span className={styles.palcoRodape}>Pontes · finanças pessoais e familiares</span>
      </aside>

      <main className={styles.painel}>
        <div className={styles.painelMiolo} data-largo={ativando || undefined}>
          <div className={styles.marcaMovel}><Logo size={26} /></div>
          {ativando ? (
            <SegurancaMfa iniciar aoConcluir={irPraVisaoGeral} aoCancelar={() => setAtivando(false)} />
          ) : (
            <>
              <h1 className={styles.titulo}>Proteja sua conta</h1>
              <p className={styles.sub}>Ative a verificação em duas etapas: além da senha, o Pontes pede um código do seu celular ao entrar.</p>
              <ul className={styles.beneficiosPainel}>
                {BENEFICIOS.map(({ icone: Icone, texto }) => (
                  <li key={texto}><span className={styles.beneficioIcone}><Icone size={16} strokeWidth={2.25} aria-hidden="true" /></span>{texto}</li>
                ))}
              </ul>
              <div className={styles.form}>
                <Botao variante="primario" tamanho="lg" cheio onClick={() => setAtivando(true)}>Ativar agora</Botao>
                <Botao tamanho="lg" cheio disabled={enviando} onClick={() => { void agoraNao() }}>{enviando ? "Um instante…" : "Agora não"}</Botao>
                <label className={styles.lembrar}>
                  <input type="checkbox" checked={nuncaMais} onChange={(e) => setNuncaMais(e.target.checked)} /> Não perguntar mais
                </label>
              </div>
              <p className={styles.rodape}>Dá pra ativar ou desativar quando quiser em Configurações.</p>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
