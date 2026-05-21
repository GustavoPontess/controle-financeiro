/**
 * RecursosPage — vertical "Recursos" (#79). Rota pública `/recursos`.
 *
 * Detalha TODAS as features do produto (mais profundo que os 3 blocos da Home).
 * Content-only sob <SiteLayout>. Paleta + fonte via `useSiteTheme()`. Importa
 * SÓ de `@/components/pontes`. Ícones via lucide-react.
 */

import { useId } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowRight, Check, LineChart, PieChart, Users, CreditCard,
  Target, FileUp, Landmark, Bell,
} from "lucide-react"
import {
  PontesButton, PontesCard, PontesBadge, PontesAvatar, PontesProgress,
} from "../../components/pontes"
import { useSiteTheme } from "./siteTheme"
import type { Palette } from "./theme"

export default function RecursosPage() {
  const { p, font } = useSiteTheme()
  return (
    <div style={{ fontFamily: font, color: p.text, background: p.surface }}>
      <Anims />
      <Hero p={p} font={font} />
      <Categorias p={p} font={font} />
      <Comparativo p={p} font={font} />
      <CtaRecursos p={p} font={font} />
    </div>
  )
}

// =============================================================================
// Helpers visuais (locais — não vão pra biblioteca)
// =============================================================================

function Anims() {
  return (
    <style>{`
      @keyframes rc-mesh { 0%,100% { transform: translate(0,0) scale(1) } 33% { transform: translate(40px,-30px) scale(1.12) } 66% { transform: translate(-25px,35px) scale(0.92) } }
      .rc-noise { position: absolute; inset: 0; pointer-events: none; opacity: 0.05; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' /%3E%3C/svg%3E"); }
    `}</style>
  )
}

function GridPattern({ color = "#FFFFFF", opacity = 0.08 }: { color?: string; opacity?: number }) {
  const id = `rc-grid-${useId().replace(/[:]/g, "")}`
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
      <div style={{ position: "absolute", left: "15%", top: "20%", width: 480, height: 480, background: p.primary, borderRadius: "50%", filter: "blur(80px)", opacity: 0.55, animation: "rc-mesh 14s ease-in-out infinite" }} />
      <div style={{ position: "absolute", right: "10%", top: "18%", width: 420, height: 420, background: p.accent, borderRadius: "50%", filter: "blur(80px)", opacity: 0.5, animation: "rc-mesh 16s ease-in-out infinite reverse" }} />
    </div>
  )
}

function Label({ p, children }: { p: Palette; children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: p.primary, textTransform: "uppercase", marginBottom: 18 }}>{children}</div>
}

function FeatureRow({ p, reverse, icon, tag, title, text, mockup }: { p: Palette; reverse: boolean; icon: React.ReactNode; tag: string; title: string; text: string; mockup: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center", padding: "60px 0", direction: reverse ? "rtl" : "ltr" }}>
      <div style={{ direction: "ltr" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, color: p.primary, marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: p.primarySoft, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" }}>{tag}</span>
        </div>
        <h3 style={{ fontSize: 36, fontWeight: 600, color: p.text, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.12, marginBottom: 16, fontFamily: "'Fraunces', serif" }}>{title}</h3>
        <p style={{ fontSize: 17, color: p.textMuted, lineHeight: 1.6, margin: 0 }}>{text}</p>
      </div>
      <div style={{ direction: "ltr", display: "flex", justifyContent: "center" }}>{mockup}</div>
    </div>
  )
}

// Card base pros mockups das categorias.
function MockCard({ p, font, children }: { p: Palette; font: string; children: React.ReactNode }) {
  return (
    <div style={{ width: 400, fontFamily: font }}>
      <PontesCard p={p} padding={24} radius={18} shadow="xl">{children}</PontesCard>
    </div>
  )
}

function MockHeader({ p, children }: { p: Palette; children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: p.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>{children}</div>
}

// =============================================================================
// HERO
// =============================================================================

function Hero({ p, font }: { p: Palette; font: string }) {
  const navigate = useNavigate()
  return (
    <section style={{ position: "relative", padding: "200px 48px 120px", background: `linear-gradient(135deg, ${p.primaryDark} 0%, ${p.primary} 100%)`, color: p.heroFg, overflow: "hidden" }}>
      <GridPattern color={p.heroFg} opacity={0.08} />
      <Mesh p={p} />
      <div className="rc-noise" />
      <div style={{ maxWidth: 880, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600, marginBottom: 28 }}>
          Tudo que o Pontes faz
        </div>
        <h1 style={{ fontSize: 68, fontWeight: 600, lineHeight: 1.05, letterSpacing: "-0.035em", margin: 0, marginBottom: 24, fontFamily: "'Fraunces', serif" }}>
          Um app de finanças{" "}
          <em style={{ fontStyle: "italic", fontFamily: "'Instrument Serif', serif", fontWeight: 400, color: p.accent }}>de verdade completo.</em>
        </h1>
        <p style={{ fontSize: 20, opacity: 0.88, lineHeight: 1.5, marginBottom: 36, maxWidth: 620, margin: "0 auto 36px" }}>
          Do lançamento diário ao Open Finance, do rateio de casal ao painel do contador. Conheça cada recurso em detalhe.
        </p>
        <PontesButton p={p} font={font} variant="accent" size="lg" iconEnd={<ArrowRight size={16} strokeWidth={2.5} />} onClick={() => navigate("/auth/register")}>Começar grátis</PontesButton>
      </div>
    </section>
  )
}

// =============================================================================
// CATEGORIAS (8 features alternadas)
// =============================================================================

function Categorias({ p, font }: { p: Palette; font: string }) {
  return (
    <section style={{ padding: "40px 48px 60px", background: p.surface }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <FeatureRow p={p} reverse={false} icon={<LineChart size={20} strokeWidth={2} />} tag="Tracking"
          title="Cada centavo no lugar certo"
          text="Lançe receitas e despesas em segundos, com categorias e subcategorias. Recorrentes e parcelados se distribuem sozinhos nos meses certos. Saldo sempre real, calculado na hora."
          mockup={<TrackingMock p={p} font={font} />} />
        <FeatureRow p={p} reverse={true} icon={<PieChart size={20} strokeWidth={2} />} tag="Orçamento"
          title="Limites que avisam antes de estourar"
          text="Defina um teto por categoria. O Pontes acompanha o gasto do mês e te alerta quando chega perto do limite — não depois que já passou."
          mockup={<BudgetMock p={p} font={font} />} />
        <FeatureRow p={p} reverse={false} icon={<Users size={20} strokeWidth={2} />} tag="Família"
          title="Dinheiro de casal e família, sem briga"
          text="Rateio explícito de quem paga o quê, aprovação de despesa grande e acerto mensal. Cada um mantém a conta privada — só o combinado aparece junto."
          mockup={<FamiliaMock p={p} font={font} />} />
        <FeatureRow p={p} reverse={true} icon={<CreditCard size={20} strokeWidth={2} />} tag="Cartão"
          title="Fatura na régua"
          text="Aberta, fechada, paga. Limite real em barra, pagamento parcial mantido e cada compra parcelada distribuída automaticamente nas faturas certas."
          mockup={<CartaoMock p={p} font={font} />} />
        <FeatureRow p={p} reverse={false} icon={<Target size={20} strokeWidth={2} />} tag="Metas"
          title="Objetivos que saem do papel"
          text="Crie metas individuais ou conjuntas — viagem, reserva de emergência, entrada do apê. Acompanhe o progresso e veja quanto poupar por mês pra chegar lá."
          mockup={<MetasMock p={p} font={font} />} />
        <FeatureRow p={p} reverse={true} icon={<FileUp size={20} strokeWidth={2} />} tag="Importação"
          title="Traga seu extrato em um clique"
          text="Importe OFX e CSV do seu banco. O Pontes reconhece e categoriza os lançamentos, evita duplicados e te poupa de digitar tudo de novo."
          mockup={<ImportMock p={p} font={font} />} />
        <FeatureRow p={p} reverse={false} icon={<Landmark size={20} strokeWidth={2} />} tag="Open Finance"
          title="Seus bancos conectados"
          text="Conecte suas contas via Open Finance e veja saldos e transações sincronizados automaticamente. Menos digitação, mais visão real do seu dinheiro."
          mockup={<OpenFinanceMock p={p} font={font} />} />
        <FeatureRow p={p} reverse={true} icon={<Bell size={20} strokeWidth={2} />} tag="Notificações"
          title="O Pontes te avisa na hora certa"
          text="Fatura fechando, limite perto do teto, despesa esperando aprovação, meta atingida. Alertas no momento que importam — sem virar spam."
          mockup={<NotifMock p={p} font={font} />} />
      </div>
    </section>
  )
}

// --- Mockups por categoria ----------------------------------------------------

function TrackingMock({ p, font }: { p: Palette; font: string }) {
  const items = [
    { c: "Mercado", s: "Alimentação", v: "− R$ 420", up: false },
    { c: "Salário", s: "Receita", v: "+ R$ 6.200", up: true },
    { c: "Uber", s: "Transporte", v: "− R$ 38", up: false },
  ]
  return (
    <MockCard p={p} font={font}>
      <MockHeader p={p}>Lançamentos · hoje</MockHeader>
      {items.map((it) => (
        <div key={it.c} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${p.border}` }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: p.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", color: p.primary, fontWeight: 800 }}>{it.c[0]}</div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700, color: p.text }}>{it.c}</div><div style={{ fontSize: 11, color: p.textMuted }}>{it.s}</div></div>
          <span style={{ fontSize: 14, fontWeight: 700, color: it.up ? "#16A34A" : p.text }}>{it.v}</span>
        </div>
      ))}
    </MockCard>
  )
}

function BudgetMock({ p, font }: { p: Palette; font: string }) {
  const cats = [
    { n: "Alimentação", pct: 82, val: "R$ 820 / 1.000" },
    { n: "Transporte", pct: 45, val: "R$ 135 / 300" },
    { n: "Lazer", pct: 97, val: "R$ 388 / 400" },
  ]
  return (
    <MockCard p={p} font={font}>
      <MockHeader p={p}>Orçamento · maio</MockHeader>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {cats.map((c) => (
          <div key={c.n}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: p.text }}>{c.n}</span>
              <span style={{ fontSize: 12, color: c.pct >= 95 ? "#DC2626" : p.textMuted, fontWeight: 600 }}>{c.val}</span>
            </div>
            <PontesProgress p={p} font={font} value={c.pct} showValue={false} color={c.pct >= 95 ? "#DC2626" : p.primary} />
          </div>
        ))}
      </div>
    </MockCard>
  )
}

function FamiliaMock({ p, font }: { p: Palette; font: string }) {
  return (
    <MockCard p={p} font={font}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div><div style={{ fontSize: 14, fontWeight: 700, color: p.text }}>Aluguel</div><div style={{ fontSize: 11, color: p.textMuted }}>Rateio 50/50</div></div>
        <span style={{ fontSize: 18, fontWeight: 800, color: p.text }}>R$ 2.800</span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, background: p.primary, color: "#FFFFFF", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><PontesAvatar p={p} size={22} name="Gustavo" /><span style={{ fontSize: 11, opacity: 0.85 }}>Gustavo</span></div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>R$ 1.400</div>
        </div>
        <div style={{ flex: 1, background: p.accent, color: "#0B1220", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><PontesAvatar p={p} size={22} name="Maria" /><span style={{ fontSize: 11, opacity: 0.85 }}>Maria</span></div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>R$ 1.400</div>
        </div>
      </div>
    </MockCard>
  )
}

function CartaoMock({ p, font }: { p: Palette; font: string }) {
  return (
    <MockCard p={p} font={font}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <MockHeader p={p}>Fatura · Nubank</MockHeader>
        <PontesBadge p={p} font={font} tone="warning" size="sm">Aberta</PontesBadge>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: p.text, marginBottom: 16 }}>R$ 2.340,00</div>
      <div style={{ marginBottom: 6 }}>
        <PontesProgress p={p} font={font} value={47} showValue={false} color={p.primary} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: p.textMuted }}>
        <span>Limite usado</span><span style={{ fontWeight: 700, color: p.text }}>R$ 2.340 / 5.000</span>
      </div>
    </MockCard>
  )
}

function MetasMock({ p, font }: { p: Palette; font: string }) {
  return (
    <MockCard p={p} font={font}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div><div style={{ fontSize: 15, fontWeight: 700, color: p.text }}>Viagem Nordeste</div><div style={{ fontSize: 11, color: p.textMuted }}>Meta conjunta</div></div>
        <PontesBadge p={p} font={font} tone="success" size="sm">68%</PontesBadge>
      </div>
      <div style={{ marginBottom: 14 }}>
        <PontesProgress p={p} font={font} value={68} showValue={false} color={p.accent} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div><div style={{ fontSize: 11, color: p.textMuted }}>Guardado</div><div style={{ fontSize: 18, fontWeight: 800, color: p.text }}>R$ 5.440</div></div>
        <div style={{ textAlign: "right" }}><div style={{ fontSize: 11, color: p.textMuted }}>Meta</div><div style={{ fontSize: 18, fontWeight: 800, color: p.textMuted }}>R$ 8.000</div></div>
      </div>
    </MockCard>
  )
}

function ImportMock({ p, font }: { p: Palette; font: string }) {
  const files = [
    { n: "extrato-nubank.ofx", s: "142 lançamentos", ok: true },
    { n: "fatura-itau.csv", s: "38 lançamentos", ok: true },
  ]
  return (
    <MockCard p={p} font={font}>
      <MockHeader p={p}>Importar extrato</MockHeader>
      <div style={{ border: `2px dashed ${p.border}`, borderRadius: 12, padding: "20px", textAlign: "center", marginBottom: 14, color: p.textMuted }}>
        <FileUp size={24} strokeWidth={2} color={p.primary} />
        <div style={{ fontSize: 13, marginTop: 8 }}>Arraste OFX ou CSV aqui</div>
      </div>
      {files.map((f) => (
        <div key={f.n} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#D1FAE5", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={14} strokeWidth={3} color="#10B981" /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700, color: p.text }}>{f.n}</div><div style={{ fontSize: 11, color: p.textMuted }}>{f.s}</div></div>
        </div>
      ))}
    </MockCard>
  )
}

function OpenFinanceMock({ p, font }: { p: Palette; font: string }) {
  const banks = [
    { n: "Nubank", s: "Sincronizado · agora", v: "R$ 4.820" },
    { n: "Itaú", s: "Sincronizado · 5min", v: "R$ 12.350" },
    { n: "Inter", s: "Sincronizado · 5min", v: "R$ 980" },
  ]
  return (
    <MockCard p={p} font={font}>
      <MockHeader p={p}>Contas conectadas</MockHeader>
      {banks.map((b) => (
        <div key={b.n} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${p.border}` }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: p.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", color: p.primary }}><Landmark size={16} strokeWidth={2} /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700, color: p.text }}>{b.n}</div><div style={{ fontSize: 11, color: "#16A34A" }}>{b.s}</div></div>
          <span style={{ fontSize: 14, fontWeight: 700, color: p.text }}>{b.v}</span>
        </div>
      ))}
    </MockCard>
  )
}

function NotifMock({ p, font }: { p: Palette; font: string }) {
  const notifs = [
    { t: "Fatura fechando amanhã", s: "Nubank · R$ 2.340", tone: "warning" as const },
    { t: "Meta Viagem em 68%", s: "Faltam R$ 2.560", tone: "success" as const },
    { t: "Aprovação pendente", s: "Geladeira · R$ 1.280", tone: "primary" as const },
  ]
  return (
    <MockCard p={p} font={font}>
      <MockHeader p={p}>Notificações</MockHeader>
      {notifs.map((n) => (
        <div key={n.t} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${p.border}` }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: p.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", color: p.primary }}><Bell size={15} strokeWidth={2} /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700, color: p.text }}>{n.t}</div><div style={{ fontSize: 11, color: p.textMuted }}>{n.s}</div></div>
          <PontesBadge p={p} font={font} tone={n.tone} size="sm">novo</PontesBadge>
        </div>
      ))}
    </MockCard>
  )
}

// =============================================================================
// COMPARATIVO (reaproveita padrão da Home)
// =============================================================================

function CheckIcon({ color }: { color: string }) {
  return <Check size={18} strokeWidth={3} color={color} style={{ display: "inline-block", verticalAlign: "middle" }} />
}

function Comparativo({ p, font }: { p: Palette; font: string }) {
  const rows = [
    { f: "Conexão Open Finance", a: true, b: false, c: true },
    { f: "Rateio entre casal", a: true, b: false, c: false },
    { f: "Aprovação de despesa", a: true, b: false, c: false },
    { f: "Acesso pra contador", a: true, b: false, c: false },
    { f: "Visão única ↔ família", a: true, b: false, c: false },
    { f: "Metas conjuntas", a: true, b: false, c: false },
    { f: "Categorias + subcategorias", a: true, b: true, c: true },
    { f: "Importação OFX/CSV", a: true, b: true, c: true },
  ]
  return (
    <section style={{ padding: "120px 48px", background: p.bg }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <Label p={p}>Comparativo</Label>
          <h2 style={{ fontSize: 52, fontWeight: 600, color: p.text, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.05, fontFamily: "'Fraunces', serif" }}>
            Por que <em style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontWeight: 400, color: p.primary }}>Pontes</em> e não os outros
          </h2>
        </div>
        <div style={{ overflow: "hidden", borderRadius: 18, border: `1px solid ${p.border}` }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font }}>
            <thead>
              <tr style={{ background: p.surface }}>
                <th style={{ textAlign: "left", padding: "20px 24px", fontWeight: 600, fontSize: 14, color: p.textMuted }}></th>
                <th style={{ textAlign: "center", padding: "20px 24px", fontWeight: 800, fontSize: 16, color: p.primary, background: p.primarySoft }}>Pontes</th>
                <th style={{ textAlign: "center", padding: "20px 24px", fontWeight: 600, fontSize: 14, color: p.textMuted }}>Mobills</th>
                <th style={{ textAlign: "center", padding: "20px 24px", fontWeight: 600, fontSize: 14, color: p.textMuted }}>Despezzas</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${p.border}`, background: p.surface }}>
                  <td style={{ padding: "16px 24px", fontSize: 14, color: p.text, fontWeight: 500 }}>{row.f}</td>
                  <td style={{ padding: "16px 24px", textAlign: "center", background: p.primarySoft }}>{row.a ? <CheckIcon color={p.primary} /> : <span style={{ color: p.textMuted, opacity: 0.5 }}>—</span>}</td>
                  <td style={{ padding: "16px 24px", textAlign: "center" }}>{row.b ? <CheckIcon color={p.textMuted} /> : <span style={{ color: p.textMuted, opacity: 0.5 }}>—</span>}</td>
                  <td style={{ padding: "16px 24px", textAlign: "center" }}>{row.c ? <CheckIcon color={p.textMuted} /> : <span style={{ color: p.textMuted, opacity: 0.5 }}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function CtaRecursos({ p, font }: { p: Palette; font: string }) {
  const navigate = useNavigate()
  return (
    <section style={{ padding: "120px 48px", background: `linear-gradient(135deg, ${p.primary} 0%, ${p.primaryDark} 100%)`, color: p.heroFg, position: "relative", overflow: "hidden" }}>
      <Mesh p={p} />
      <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
        <h2 style={{ fontSize: 56, fontWeight: 600, margin: 0, letterSpacing: "-0.025em", lineHeight: 1.05, fontFamily: "'Fraunces', serif", marginBottom: 24 }}>
          Tudo isso{" "}
          <em style={{ fontStyle: "italic", fontFamily: "'Instrument Serif', serif", fontWeight: 400, color: p.accent }}>num app só.</em>
        </h2>
        <p style={{ fontSize: 19, opacity: 0.88, marginBottom: 40, lineHeight: 1.5 }}>Grátis pra começar. Sem cartão de crédito, sem pegadinha.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <PontesButton p={p} font={font} variant="accent" size="lg" iconEnd={<ArrowRight size={16} strokeWidth={2.5} />} onClick={() => navigate("/auth/register")}>Criar conta grátis</PontesButton>
          <PontesButton p={p} font={font} variant="outline-light" size="lg" onClick={() => navigate("/casais")}>Ver plano Família</PontesButton>
        </div>
      </div>
    </section>
  )
}
