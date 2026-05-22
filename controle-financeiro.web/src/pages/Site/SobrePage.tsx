/**
 * SobrePage — página institucional "Sobre / Manifesto" (#80). Rota `/sobre`.
 *
 * Quem é o time, por que o Pontes existe, manifesto da marca. Content-only sob
 * <SiteLayout>. Paleta + fonte via `useSiteTheme()`. Importa SÓ de
 * `@/components/pontes`. Headlines em Fraunces serif. Ícones via lucide-react.
 */

import { useId } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowRight, Heart, Shield, Eye, Sparkles, MapPin, Mail } from "lucide-react"
import { PontesButton, PontesCard } from "../../components/pontes"
import { useSiteTheme } from "./siteTheme"
import type { Palette } from "./theme"

export default function SobrePage() {
  const { p, font } = useSiteTheme()
  return (
    <div style={{ fontFamily: font, color: p.text, background: p.surface }}>
      <Anims />
      <Manifesto p={p} font={font} />
      <Historia p={p} />
      <Valores p={p} />
      <Time p={p} />
      <OndeEstamos p={p} font={font} />
      <Contato p={p} font={font} />
    </div>
  )
}

// =============================================================================
// Helpers visuais (locais — não vão pra biblioteca)
// =============================================================================

function Anims() {
  return (
    <style>{`
      @keyframes sb-mesh { 0%,100% { transform: translate(0,0) scale(1) } 33% { transform: translate(40px,-30px) scale(1.12) } 66% { transform: translate(-25px,35px) scale(0.92) } }
      .sb-noise { position: absolute; inset: 0; pointer-events: none; opacity: 0.05; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' /%3E%3C/svg%3E"); }
    `}</style>
  )
}

function GridPattern({ color = "#FFFFFF", opacity = 0.08 }: { color?: string; opacity?: number }) {
  const id = `sb-grid-${useId().replace(/[:]/g, "")}`
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      <defs>
        <pattern id={id} width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke={color} strokeWidth="1" opacity={opacity} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

function Mesh({ p }: { p: Palette }) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: "15%", top: "20%", width: 480, height: 480, background: p.primary, borderRadius: "50%", filter: "blur(80px)", opacity: 0.55, animation: "sb-mesh 14s ease-in-out infinite" }} />
      <div style={{ position: "absolute", right: "10%", top: "18%", width: 420, height: 420, background: p.accent, borderRadius: "50%", filter: "blur(80px)", opacity: 0.5, animation: "sb-mesh 16s ease-in-out infinite reverse" }} />
    </div>
  )
}

function Label({ p, children }: { p: Palette; children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: p.primary, textTransform: "uppercase", marginBottom: 18 }}>{children}</div>
}

function H2({ p, children }: { p: Palette; children: React.ReactNode }) {
  return <h2 style={{ fontSize: 44, fontWeight: 600, color: p.text, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.08, fontFamily: "'Fraunces', serif", marginBottom: 18 }}>{children}</h2>
}

// =============================================================================
// SECTIONS
// =============================================================================

function Manifesto({ p, font }: { p: Palette; font: string }) {
  const navigate = useNavigate()
  return (
    <section style={{ position: "relative", padding: "210px 48px 140px", background: `linear-gradient(135deg, ${p.primaryDark} 0%, ${p.primary} 100%)`, color: p.heroFg, overflow: "hidden" }}>
      <GridPattern color={p.heroFg} opacity={0.08} />
      <Mesh p={p} />
      <div className="sb-noise" />
      <div style={{ maxWidth: 920, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600, marginBottom: 32 }}>
          <Sparkles size={14} strokeWidth={2.5} color={p.accent} /> Nosso manifesto
        </div>
        <h1 style={{ fontSize: 64, fontWeight: 600, lineHeight: 1.12, letterSpacing: "-0.03em", margin: 0, marginBottom: 28, fontFamily: "'Fraunces', serif" }}>
          Dinheiro é coisa de{" "}
          <em style={{ fontStyle: "italic", fontFamily: "'Instrument Serif', serif", fontWeight: 400, color: p.accent }}>duas pessoas</em>{" "}— ou de uma família inteira.
        </h1>
        <p style={{ fontSize: 21, opacity: 0.9, lineHeight: 1.6, maxWidth: 680, margin: "0 auto 40px" }}>
          Todo app de finanças trata você como um indivíduo isolado. Mas a vida real é dividida: aluguel a dois, mercado em família, contas que se misturam. O Pontes nasceu pra organizar o dinheiro de quem vive junto — sem briga, sem planilha, sem perder a privacidade.
        </p>
        <PontesButton p={p} font={font} variant="accent" size="lg" iconEnd={<ArrowRight size={16} strokeWidth={2.5} />} onClick={() => navigate("/auth/register")}>Fazer parte</PontesButton>
      </div>
    </section>
  )
}

function Historia({ p }: { p: Palette }) {
  const paras = [
    "Começou com uma briga boba sobre quem tinha pagado mais no mês. A gente percebeu que nenhum app brasileiro respondia uma pergunta simples: “quem deve quanto pra quem?”",
    "Os apps existentes são feitos pra uma pessoa só. Quando duas pessoas dividem a vida, eles falham — cada um lança no seu silo, ninguém vê o todo, e no fim do mês vira discussão.",
    "Decidimos construir o que faltava: um app onde casais e famílias enxergam o dinheiro junto, dividem o que é compartilhado e mantêm privado o que é pessoal. Transparência sem invasão.",
  ]
  return (
    <section style={{ padding: "120px 48px", background: p.surface }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Label p={p}>Por que existimos</Label>
        <H2 p={p}>Nasceu de uma <em style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontWeight: 400, color: p.primary }}>conta dividida.</em></H2>
        <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 12 }}>
          {paras.map((t, i) => (
            <p key={i} style={{ fontSize: 18, color: p.textMuted, lineHeight: 1.7, margin: 0 }}>{t}</p>
          ))}
        </div>
      </div>
    </section>
  )
}

function Valores({ p }: { p: Palette }) {
  const vals = [
    { icon: <Shield size={26} strokeWidth={2} />, t: "Privacidade primeiro", d: "Sua conta pessoal é sua. Nada vira compartilhado sem você marcar. Default seguro, sempre." },
    { icon: <Eye size={26} strokeWidth={2} />, t: "Transparência sem briga", d: "Tudo explícito: quem pagou, quem deve, quanto falta. Linguagem que organiza, não que acusa." },
    { icon: <Heart size={26} strokeWidth={2.5} />, t: "Feito pro Brasil", d: "Pix, OFX dos bancos daqui, realidade da família brasileira. Não é tradução de app gringo." },
    { icon: <Sparkles size={26} strokeWidth={2} />, t: "Simples de verdade", d: "Poderoso por dentro, leve por fora. Em 15 minutos tá rodando — sem manual, sem curva." },
  ]
  return (
    <section style={{ padding: "120px 48px", background: p.bg }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <Label p={p}>No que acreditamos</Label>
          <H2 p={p}>Nossos <em style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontWeight: 400, color: p.primary }}>valores.</em></H2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 24 }}>
          {vals.map((v) => (
            <PontesCard key={v.t} p={p} padding={32} radius={22}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 18 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: p.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", color: p.primary, flexShrink: 0 }}>{v.icon}</div>
                <div>
                  <div style={{ fontSize: 21, fontWeight: 700, color: p.text, marginBottom: 8 }}>{v.t}</div>
                  <div style={{ fontSize: 15, color: p.textMuted, lineHeight: 1.6 }}>{v.d}</div>
                </div>
              </div>
            </PontesCard>
          ))}
        </div>
      </div>
    </section>
  )
}

function Time({ p }: { p: Palette }) {
  const team = [
    { nome: "Gustavo Pontes", papel: "Fundador · Produto & Engenharia", photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&auto=format&fit=crop&q=80" },
    { nome: "Caio Amaral", papel: "Cofundador · Engenharia & Design", photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&auto=format&fit=crop&q=80" },
    { nome: "João Vitor Costa", papel: "Cofundador · Engenharia", photo: "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=300&h=300&auto=format&fit=crop&q=80" },
  ]
  return (
    <section style={{ padding: "120px 48px", background: p.surface }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <Label p={p}>Quem faz</Label>
          <H2 p={p}>Um time <em style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontWeight: 400, color: p.primary }}>enxuto e obcecado.</em></H2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32, maxWidth: 760, margin: "0 auto" }}>
          {team.map((m) => (
            <div key={m.nome} style={{ textAlign: "center" }}>
              <div style={{ width: 132, height: 132, margin: "0 auto 18px", borderRadius: "50%", overflow: "hidden", border: `3px solid ${p.primarySoft}` }}>
                <img src={m.photo} alt={m.nome} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
              <div style={{ fontSize: 19, fontWeight: 700, color: p.text, marginBottom: 4 }}>{m.nome}</div>
              <div style={{ fontSize: 14, color: p.textMuted }}>{m.papel}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function OndeEstamos({ p, font }: { p: Palette; font: string }) {
  return (
    <section style={{ padding: "120px 48px", background: p.bg }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 64, alignItems: "center" }}>
        <div style={{ position: "relative", borderRadius: 22, overflow: "hidden", aspectRatio: "4/3" }}>
          <img src="https://images.unsplash.com/photo-1543059080-f9b1272213d5?w=800&auto=format&fit=crop&q=80" alt="Brasil" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          <div style={{ position: "absolute", bottom: 16, left: 16, background: "rgba(255,255,255,0.95)", padding: "8px 14px", borderRadius: 12, fontFamily: font, fontSize: 13, fontWeight: 700, color: p.text, display: "flex", alignItems: "center", gap: 8 }}>
            <MapPin size={14} strokeWidth={2.5} color={p.primary} /> Brasil · 100% remoto
          </div>
        </div>
        <div>
          <Label p={p}>Onde estamos</Label>
          <H2 p={p}>Brasileiros, <em style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontWeight: 400, color: p.primary }}>pra brasileiros.</em></H2>
          <p style={{ fontSize: 18, color: p.textMuted, lineHeight: 1.7, margin: 0 }}>
            Time distribuído pelo Brasil, construindo um produto que entende a realidade financeira daqui. Pix, bancos nacionais, a forma como a família brasileira de fato divide as contas. Perto de quem usa, longe de fórmula importada.
          </p>
        </div>
      </div>
    </section>
  )
}

function Contato({ p, font }: { p: Palette; font: string }) {
  const navigate = useNavigate()
  return (
    <section style={{ padding: "120px 48px", background: `linear-gradient(135deg, ${p.primary} 0%, ${p.primaryDark} 100%)`, color: p.heroFg, position: "relative", overflow: "hidden" }}>
      <Mesh p={p} />
      <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
        <h2 style={{ fontSize: 54, fontWeight: 600, margin: 0, letterSpacing: "-0.025em", lineHeight: 1.06, fontFamily: "'Fraunces', serif", marginBottom: 24 }}>
          Vamos construir isso{" "}
          <em style={{ fontStyle: "italic", fontFamily: "'Instrument Serif', serif", fontWeight: 400, color: p.accent }}>juntos?</em>
        </h2>
        <p style={{ fontSize: 19, opacity: 0.9, marginBottom: 36, lineHeight: 1.5 }}>Dúvida, ideia ou só um oi — a gente lê tudo. E se quiser começar agora, é grátis.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 28 }}>
          <PontesButton p={p} font={font} variant="accent" size="lg" iconEnd={<ArrowRight size={16} strokeWidth={2.5} />} onClick={() => navigate("/auth/register")}>Criar conta grátis</PontesButton>
          <PontesButton p={p} font={font} variant="outline-light" size="lg" iconStart={<Mail size={16} strokeWidth={2.5} />} onClick={() => navigate("/recursos")}>Ver recursos</PontesButton>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, opacity: 0.85 }}>
          <Mail size={15} strokeWidth={2} /> contato@pontes.app
        </div>
      </div>
    </section>
  )
}
