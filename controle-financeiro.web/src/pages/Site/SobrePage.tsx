/**
 * SobrePage — página institucional "Sobre / Manifesto" (#80). Rota `/sobre`.
 *
 * Quem é o time, por que o Pontes existe, manifesto da marca. Content-only sob
 * <SiteLayout>. Estilo via CSS Modules + var(--pontes-*) (#122). Importa SÓ de
 * `@/components/pontes`. Headlines em Fraunces serif. Ícones via lucide-react.
 */

import { useNavigate } from "react-router-dom"
import { ArrowRight, Heart, Shield, Eye, Sparkles, MapPin, Mail } from "lucide-react"
import { PontesButton, PontesCard } from "../../components/pontes"
import styles from "./SobrePage.module.css"

export default function SobrePage() {
  return (
    <div className={styles.root}>
      <Manifesto />
      <Historia />
      <Valores />
      <Time />
      <OndeEstamos />
      <Contato />
    </div>
  )
}

// =============================================================================
// Helpers visuais (locais — não vão pra biblioteca)
// =============================================================================

/** Grade decorativa sobre o hero. Stroke branco fixo (SVG não lê var()). */
function GridPattern() {
  return (
    <svg className={styles.grid}>
      <defs>
        <pattern id="sb-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#FFFFFF" strokeWidth="1" opacity={0.08} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#sb-grid)" />
    </svg>
  )
}

function Mesh() {
  return (
    <div className={styles.mesh}>
      <div className={styles.meshBlobA} />
      <div className={styles.meshBlobB} />
    </div>
  )
}

// =============================================================================
// SECTIONS
// =============================================================================

function Manifesto() {
  const navigate = useNavigate()
  return (
    <section className={styles.hero}>
      <GridPattern />
      <Mesh />
      <div className={styles.noise} />
      <div className={styles.heroInner}>
        <div className={styles.badge}>
          <span className={styles.badgeIcon}><Sparkles size={14} strokeWidth={2.5} /></span> Nosso manifesto
        </div>
        <h1 className={styles.heroTitle}>
          Dinheiro é coisa de{" "}
          <em className={styles.emAccent}>duas pessoas</em>{" "}— ou de uma família inteira.
        </h1>
        <p className={styles.heroLead}>
          Todo app de finanças trata você como um indivíduo isolado. Mas a vida real é dividida: aluguel a dois, mercado em família, contas que se misturam. O Pontes nasceu pra organizar o dinheiro de quem vive junto — sem briga, sem planilha, sem perder a privacidade.
        </p>
        <PontesButton variant="accent" size="lg" iconEnd={<ArrowRight size={16} strokeWidth={2.5} />} onClick={() => navigate("/auth/register")}>Fazer parte</PontesButton>
      </div>
    </section>
  )
}

function Historia() {
  const paras = [
    "Começou com uma briga boba sobre quem tinha pagado mais no mês. A gente percebeu que nenhum app brasileiro respondia uma pergunta simples: “quem pagou mais, e como acertar isso?”",
    "Os apps existentes são feitos pra uma pessoa só. Quando duas pessoas dividem a vida, eles falham — cada um lança no seu silo, ninguém vê o todo, e no fim do mês vira discussão.",
    "Decidimos construir o que faltava: um app onde casais e famílias enxergam o dinheiro junto, dividem o que é compartilhado e mantêm privado o que é pessoal. Transparência sem invasão.",
  ]
  return (
    <section className={styles.sectionSurface}>
      <div className={styles.narrow}>
        <div className={styles.label}>Por que existimos</div>
        <h2 className={styles.h2}>Nasceu de uma <em className={styles.em}>conta dividida.</em></h2>
        <div className={styles.paras}>
          {paras.map((t, i) => (
            <p key={i} className={styles.para}>{t}</p>
          ))}
        </div>
      </div>
    </section>
  )
}

function Valores() {
  const vals = [
    { icon: <Shield size={26} strokeWidth={2} />, t: "Privacidade primeiro", d: "Sua conta pessoal é sua. Nada vira compartilhado sem você marcar. Default seguro, sempre." },
    { icon: <Eye size={26} strokeWidth={2} />, t: "Transparência sem briga", d: "Tudo explícito: quem pagou, quem adiantou, quanto acertar. Linguagem que organiza, não que acusa." },
    { icon: <Heart size={26} strokeWidth={2.5} />, t: "Feito pro Brasil", d: "Pix, OFX dos bancos daqui, realidade da família brasileira. Não é tradução de app gringo." },
    { icon: <Sparkles size={26} strokeWidth={2} />, t: "Simples de verdade", d: "Poderoso por dentro, leve por fora. Em 15 minutos tá rodando — sem manual, sem curva." },
  ]
  return (
    <section className={styles.sectionBg}>
      <div className={styles.wide}>
        <div className={styles.center}>
          <div className={styles.label}>No que acreditamos</div>
          <h2 className={styles.h2}>Nossos <em className={styles.em}>valores.</em></h2>
        </div>
        <div className={styles.valGrid}>
          {vals.map((v) => (
            <PontesCard key={v.t} padding={32} radius={22}>
              <div className={styles.valItem}>
                <div className={styles.valIcon}>{v.icon}</div>
                <div>
                  <div className={styles.valTitle}>{v.t}</div>
                  <div className={styles.valDesc}>{v.d}</div>
                </div>
              </div>
            </PontesCard>
          ))}
        </div>
      </div>
    </section>
  )
}

function Time() {
  const team = [
    { nome: "Gustavo Pontes", papel: "Fundador · Produto & Engenharia", photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&auto=format&fit=crop&q=80" },
  ]
  return (
    <section className={styles.sectionSurface}>
      <div className={styles.teamOuter}>
        <div className={styles.center}>
          <div className={styles.label}>Quem faz</div>
          <h2 className={styles.h2}>Um time <em className={styles.em}>enxuto e obcecado.</em></h2>
        </div>
        <div className={styles.teamGrid}>
          {team.map((m) => (
            <div key={m.nome} className={styles.member}>
              <div className={styles.memberPhoto}>
                <img src={m.photo} alt={m.nome} className={styles.memberImg} />
              </div>
              <div className={styles.memberName}>{m.nome}</div>
              <div className={styles.memberRole}>{m.papel}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function OndeEstamos() {
  return (
    <section className={styles.sectionBg}>
      <div className={styles.ondeGrid}>
        <div className={styles.ondeImgWrap}>
          <img src="https://images.unsplash.com/photo-1543059080-f9b1272213d5?w=800&auto=format&fit=crop&q=80" alt="Brasil" className={styles.ondeImg} />
          <div className={styles.ondeTag}>
            <span className={styles.ondeTagIcon}><MapPin size={14} strokeWidth={2.5} /></span> Brasil · 100% remoto
          </div>
        </div>
        <div>
          <div className={styles.label}>Onde estamos</div>
          <h2 className={styles.h2}>Brasileiros, <em className={styles.em}>pra brasileiros.</em></h2>
          <p className={styles.ondeText}>
            Time distribuído pelo Brasil, construindo um produto que entende a realidade financeira daqui. Pix, bancos nacionais, a forma como a família brasileira de fato divide as contas. Perto de quem usa, longe de fórmula importada.
          </p>
        </div>
      </div>
    </section>
  )
}

function Contato() {
  const navigate = useNavigate()
  return (
    <section className={styles.contato}>
      <Mesh />
      <div className={styles.contatoInner}>
        <h2 className={styles.contatoTitle}>
          Vamos construir isso{" "}
          <em className={styles.emAccent}>juntos?</em>
        </h2>
        <p className={styles.contatoLead}>Dúvida, ideia ou só um oi — a gente lê tudo. E se quiser começar agora, é grátis.</p>
        <div className={styles.contatoBtns}>
          <PontesButton variant="accent" size="lg" iconEnd={<ArrowRight size={16} strokeWidth={2.5} />} onClick={() => navigate("/auth/register")}>Criar conta grátis</PontesButton>
          <PontesButton variant="outline-light" size="lg" iconStart={<Mail size={16} strokeWidth={2.5} />} onClick={() => navigate("/recursos")}>Ver recursos</PontesButton>
        </div>
        <div className={styles.contatoMail}>
          <Mail size={15} strokeWidth={2} /> contato@pontes.app
        </div>
      </div>
    </section>
  )
}
