/**
 * Design System — rota pública /design-system.
 *
 * Showcase ao vivo da biblioteca de componentes Pontes. Trocador de paleta +
 * fonte no topo aplica em tudo. Cada categoria é uma seção com exemplos
 * usando os componentes REAIS importados de `@/components/pontes`.
 *
 * Quando #90 (personalização in-app) entregar, o trocador some — a paleta vem
 * do contexto global do usuário.
 */

import { useEffect, useState } from "react"
import {
  Plus, Download, ArrowRight, ChevronLeft, ChevronRight,
  Settings, MoreHorizontal, Bell, Search, Pencil, Copy, Share2, Trash2,
} from "lucide-react"
import {
  // theme
  palettes, fonts, semantic, type Palette, type FontOption,
  // botões
  PontesButton, PontesIconButton, PontesFab, PontesButtonGroup, PontesLink, PontesNavLink,
  // form
  PontesField, PontesInput, PontesMoneyInput, PontesTextarea,
  PontesSelect, PontesToggle, PontesCheckbox, PontesRadioGroup,
  PontesOtpInput, PontesSlider, PontesDatePicker, PontesFileDrop,
  PontesTagInput, PontesColorPicker, PontesRating, PontesKbd, PontesKbdGroup,
  // dados
  PontesBadge, PontesAvatar, PontesAvatarStack, PontesAlert,
  PontesProgress, PontesStatCard, PontesCard, PontesTable,
  // feedback
  PontesToast, PontesModal, PontesDialog, PontesSkeleton, PontesSkeletonList,
  PontesEmptyState, PontesLoadingDots, PontesDrawer,
  PontesTooltip, PontesPopover,
  // navegação
  PontesBreadcrumb, PontesTabs, PontesStepper, PontesPagination,
  PontesCommandPalette,
  // site
  PontesFooter,
  // util
  applyPontesScrollbar, usePontesBodyScrollbar,
} from "../../components/pontes"

type TabId = "botoes" | "form" | "data" | "feedback" | "navegacao" | "site" | "tokens"

const TABS: { value: TabId; label: string }[] = [
  { value: "botoes", label: "Botões" },
  { value: "form", label: "Form & Inputs" },
  { value: "data", label: "Cards & Dados" },
  { value: "feedback", label: "Feedback" },
  { value: "navegacao", label: "Navegação" },
  { value: "site", label: "Site" },
  { value: "tokens", label: "Tokens" },
]

export default function DesignSystemPage() {
  const [paletteId, setPaletteId] = useState("A")
  const [fontId, setFontId] = useState("plus-jakarta")
  const [tab, setTab] = useState<TabId>("botoes")

  const palette = palettes.find((x) => x.id === paletteId) ?? palettes[0]
  const fontOpt = fonts.find((x) => x.id === fontId) ?? fonts[0]
  const font = fontOpt.family

  // Override body { overflow: hidden } global.
  useEffect(() => {
    const prev = {
      bodyO: document.body.style.overflow,
      htmlO: document.documentElement.style.overflow,
      bodyH: document.body.style.height,
      htmlH: document.documentElement.style.height,
    }
    document.body.style.overflow = "auto"
    document.documentElement.style.overflow = "auto"
    document.body.style.height = "auto"
    document.documentElement.style.height = "auto"
    const root = document.getElementById("root")
    if (root) root.style.height = "auto"
    return () => {
      document.body.style.overflow = prev.bodyO
      document.documentElement.style.overflow = prev.htmlO
      document.body.style.height = prev.bodyH
      document.documentElement.style.height = prev.htmlH
    }
  }, [])

  // Injeta fonte escolhida.
  useEffect(() => {
    const linkId = `ds-font-${fontOpt.id}`
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link")
      link.id = linkId
      link.rel = "stylesheet"
      link.href = fontOpt.url
      document.head.appendChild(link)
    }
  }, [fontOpt])

  // Scrollbar overlay (accent) sempre visível + fundo da página no body.
  usePontesBodyScrollbar(palette.accent)
  useEffect(() => { applyPontesScrollbar(palette.accent, palette.bg) }, [palette])

  return (
    <div style={{ minHeight: "100vh", background: palette.bg, fontFamily: font, color: palette.text }}>
      <ControlBar
        palette={palette} fontOpt={fontOpt}
        paletteId={paletteId} setPaletteId={setPaletteId}
        fontId={fontId} setFontId={setFontId}
      />

      <div style={{ paddingTop: 80 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 48px 0", textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.18em", color: palette.primary, textTransform: "uppercase", marginBottom: 14 }}>
            Documentação
          </div>
          <h1 style={{ fontSize: 48, fontWeight: 800, color: palette.text, margin: 0, letterSpacing: "-0.025em" }}>
            Pontes — Design System
          </h1>
          <p style={{ fontSize: 16, color: palette.textMuted, marginTop: 12, maxWidth: 720, marginInline: "auto" }}>
            Biblioteca de componentes reutilizáveis em <code style={{ background: palette.surface, padding: "2px 8px", borderRadius: 6, border: `1px solid ${palette.border}`, fontSize: 13 }}>@/components/pontes</code>. Trocar paleta e fonte no topo aplica em tudo ao vivo.
          </p>
        </div>

        <div style={{ maxWidth: 1280, margin: "32px auto 0", padding: "0 48px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
            <PontesTabs<TabId>
              p={palette} font={font}
              options={TABS}
              value={tab}
              onChange={setTab}
              variant="pills"
            />
          </div>

          <div style={{ background: palette.surface, border: `1px solid ${palette.border}`, borderRadius: 22, padding: 36 }}>
            {tab === "botoes" && <ButtonsSection p={palette} font={font} />}
            {tab === "form" && <FormSection p={palette} font={font} />}
            {tab === "data" && <DataSection p={palette} font={font} />}
            {tab === "feedback" && <FeedbackSection p={palette} font={font} />}
            {tab === "navegacao" && <NavSection p={palette} font={font} />}
            {tab === "site" && <SiteSection p={palette} font={font} />}
            {tab === "tokens" && <TokensSection p={palette} font={font} />}
          </div>
        </div>
        <div style={{ height: 80 }} />
      </div>
    </div>
  )
}

// =============================================================================
// Control bar (paleta + fonte)
// =============================================================================

function ControlBar({
  palette, fontOpt, paletteId, setPaletteId, fontId, setFontId,
}: {
  palette: Palette; fontOpt: FontOption
  paletteId: string; setPaletteId: (v: string) => void
  fontId: string; setFontId: (v: string) => void
}) {
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
      background: "#0B1220", color: "#FFFFFF",
      padding: "12px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      fontFamily: "system-ui, sans-serif", fontSize: 13,
      borderBottom: "2px solid #1E293B", boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    }}>
      <div style={{ fontWeight: 700, letterSpacing: "0.1em", fontSize: 11 }}>📐 DESIGN SYSTEM</div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ opacity: 0.6 }}>Paleta:</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {palettes.map((pp) => (
            <button
              key={pp.id} onClick={() => setPaletteId(pp.id)} title={pp.label}
              style={{
                background: paletteId === pp.id ? "#FFFFFF" : "transparent",
                color: paletteId === pp.id ? "#0B1220" : "#FFFFFF",
                border: `1px solid ${paletteId === pp.id ? "#FFFFFF" : "#334155"}`,
                padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <span style={{ width: 12, height: 12, background: pp.primary, borderRadius: 3 }} />
              <span style={{ width: 12, height: 12, background: pp.accent, borderRadius: 3 }} />
              <span>{pp.id}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ opacity: 0.6 }}>Fonte:</span>
        <select
          value={fontId} onChange={(e) => setFontId(e.target.value)}
          style={{
            background: "#1E293B", color: "#FFFFFF",
            border: "1px solid #334155", padding: "6px 10px", borderRadius: 8,
            fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "system-ui, sans-serif",
          }}
        >
          {fonts.map((f) => (
            <option key={f.id} value={f.id}>{f.label} — {f.description}</option>
          ))}
        </select>
      </div>

      <div style={{ marginLeft: "auto", opacity: 0.55, fontSize: 11 }}>
        {palette.label} · {fontOpt.label}
      </div>
    </div>
  )
}

// =============================================================================
// Helper: Section + Group
// =============================================================================

function Group({ title, p, children }: { title: string; p: Palette; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: p.textMuted,
        letterSpacing: "0.12em", marginBottom: 14, textTransform: "uppercase",
      }}>{title}</div>
      <div style={{ background: p.bg, border: `1px solid ${p.border}`, borderRadius: 14, padding: 24 }}>
        {children}
      </div>
    </div>
  )
}

// =============================================================================
// BUTTONS SECTION
// =============================================================================

function ButtonsSection({ p, font }: { p: Palette; font: string }) {
  const [periodTab, setPeriodTab] = useState<"dia" | "semana" | "mes" | "ano">("mes")
  const [navStep, setNavStep] = useState<"anterior" | "hoje" | "proximo">("hoje")

  return (
    <div>
      <Group title="Variantes" p={p}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <PontesButton p={p} font={font} variant="primary">Primário</PontesButton>
          <PontesButton p={p} font={font} variant="accent">Acento</PontesButton>
          <PontesButton p={p} font={font} variant="outline">Outline</PontesButton>
          <PontesButton p={p} font={font} variant="ghost">Ghost</PontesButton>
          <PontesButton p={p} font={font} variant="soft">Soft</PontesButton>
          <PontesButton p={p} font={font} variant="danger">Perigo</PontesButton>
          <PontesButton p={p} font={font} variant="danger-outline">Perigo outline</PontesButton>
          <PontesLink p={p} font={font}>Link</PontesLink>
          <PontesButton p={p} font={font} variant="primary" disabled>Desabilitado</PontesButton>
        </div>
      </Group>

      <Group title="Variantes sobre fundo escuro (glass)" p={p}>
        <div style={{ background: `linear-gradient(135deg, ${p.primaryDark}, ${p.primary})`, padding: 24, borderRadius: 14, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <PontesButton p={p} font={font} variant="outline-light">Outline light</PontesButton>
          <PontesButton p={p} font={font} variant="ghost-light">Ghost light</PontesButton>
          <PontesButton p={p} font={font} variant="accent">Acento</PontesButton>
        </div>
      </Group>

      <Group title="Tamanhos" p={p}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          {(["xs", "sm", "md", "lg", "xl"] as const).map((s) => (
            <PontesButton key={s} p={p} font={font} size={s}>{s.toUpperCase()}</PontesButton>
          ))}
        </div>
      </Group>

      <Group title="Com ícone + Estados" p={p}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <PontesButton p={p} font={font} iconStart={<Plus size={18} strokeWidth={2.5} />}>Nova transação</PontesButton>
          <PontesButton p={p} font={font} variant="accent" iconStart={<Download size={16} strokeWidth={2.5} />}>Importar OFX</PontesButton>
          <PontesButton p={p} font={font} variant="outline" iconEnd={<ArrowRight size={16} strokeWidth={2.5} />}>Salvar e continuar</PontesButton>
          <PontesButton p={p} font={font} loading>Salvando...</PontesButton>
          <PontesButton p={p} font={font} success>Salvo</PontesButton>
        </div>
      </Group>

      <Group title="Icon-only + FAB + Badge" p={p}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <PontesIconButton p={p} size={32}><Plus size={18} strokeWidth={3} /></PontesIconButton>
          <PontesIconButton p={p} size={40}><Plus size={20} strokeWidth={2.5} /></PontesIconButton>
          <PontesIconButton p={p} size={48}><Plus size={22} strokeWidth={2.5} /></PontesIconButton>
          <PontesIconButton p={p} size={40} variant="soft"><Settings size={18} strokeWidth={2} /></PontesIconButton>
          <PontesIconButton p={p} size={40} variant="outline"><MoreHorizontal size={18} strokeWidth={2.5} /></PontesIconButton>
          <PontesIconButton p={p} size={40} variant="outline" badge={3}><Bell size={18} strokeWidth={2} /></PontesIconButton>
          <PontesFab p={p}><Plus size={26} strokeWidth={2.5} /></PontesFab>
        </div>
      </Group>

      <Group title="Button group (segmented & joined)" p={p}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <PontesButtonGroup
            p={p} font={font}
            value={periodTab}
            onChange={setPeriodTab}
            options={[
              { value: "dia", label: "Dia" },
              { value: "semana", label: "Semana" },
              { value: "mes", label: "Mês" },
              { value: "ano", label: "Ano" },
            ]}
          />
          <PontesButtonGroup
            p={p} font={font}
            variant="joined"
            value={navStep}
            onChange={setNavStep}
            options={[
              { value: "anterior", label: <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><ChevronLeft size={14} strokeWidth={2.5} /> Anterior</span> },
              { value: "hoje", label: "Hoje" },
              { value: "proximo", label: <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>Próximo <ChevronRight size={14} strokeWidth={2.5} /></span> },
            ]}
          />
        </div>
      </Group>

      <Group title="NavLink (underline animado, não desloca texto)" p={p}>
        <div style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" }}>
          <PontesNavLink p={p} font={font} active>Recursos</PontesNavLink>
          <PontesNavLink p={p} font={font}>Para Casais</PontesNavLink>
          <PontesNavLink p={p} font={font}>Para Contadores</PontesNavLink>
          <PontesNavLink p={p} font={font}>Sobre</PontesNavLink>
        </div>
      </Group>

      <Group title="Link inline" p={p}>
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <PontesLink p={p} font={font}>Saiba mais</PontesLink>
          <PontesLink p={p} font={font}>Termos de uso</PontesLink>
          <PontesLink p={p} font={font}>Esqueci a senha</PontesLink>
        </div>
      </Group>
    </div>
  )
}

// =============================================================================
// FORM SECTION
// =============================================================================

function FormSection({ p, font }: { p: Palette; font: string }) {
  const [text, setText] = useState("voce@email.com")
  const [money, setMoney] = useState("1.240,00")
  const [categoria, setCategoria] = useState("mercado")
  const [conta, setConta] = useState("nubank")
  const [notif, setNotif] = useState(true)
  const [dark, setDark] = useState(false)
  const [remember, setRemember] = useState(true)
  const [terms, setTerms] = useState(false)
  const [period, setPeriod] = useState<"mensal" | "anual">("mensal")
  const [otp, setOtp] = useState("835")
  const [sliderV, setSliderV] = useState(4500)
  const [date, setDate] = useState<Date | null>(new Date())
  const [tags, setTags] = useState(["Família", "Mensal", "Recorrente"])
  const [color, setColor] = useState(p.primary)
  const [rating, setRating] = useState(4)

  return (
    <div>
      <Group title="Inputs" p={p}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <PontesField p={p} font={font} label="E-mail" required>
            <PontesInput p={p} font={font} value={text} onChange={(e) => setText(e.target.value)} placeholder="voce@email.com" />
          </PontesField>
          <PontesField p={p} font={font} label="Senha">
            <PontesInput p={p} font={font} type="password" defaultValue="senha123" />
          </PontesField>
          <PontesField p={p} font={font} label="Buscar">
            <PontesInput p={p} font={font} iconStart={<Search size={16} />} placeholder="Buscar transação..." />
          </PontesField>
          <PontesField p={p} font={font} label="Com erro" error="E-mail inválido">
            <PontesInput p={p} font={font} invalid defaultValue="email-invalido" />
          </PontesField>
          <PontesField p={p} font={font} label="Categoria">
            <PontesSelect
              p={p} font={font}
              value={categoria}
              onChange={setCategoria}
              options={[
                { value: "mercado", label: "Mercado" },
                { value: "lazer", label: "Lazer" },
                { value: "casa", label: "Casa" },
                { value: "transporte", label: "Transporte" },
                { value: "assinatura", label: "Assinatura" },
                { value: "saude", label: "Saúde" },
                { value: "outros", label: "Outros" },
              ]}
            />
          </PontesField>
          <PontesField p={p} font={font} label="Conta">
            <PontesSelect
              p={p} font={font}
              value={conta}
              onChange={setConta}
              options={["nubank", "itau", "bradesco", "bb", "inter", "c6", "carteira"]}
            />
          </PontesField>
          <PontesField p={p} font={font} label="Textarea">
            <PontesTextarea p={p} font={font} placeholder="Observação..." />
          </PontesField>
        </div>
      </Group>

      <Group title="Money input" p={p}>
        <PontesMoneyInput p={p} font={font} value={money} onChange={setMoney} />
      </Group>

      <Group title="OTP code" p={p}>
        <PontesOtpInput p={p} font={font} value={otp} onChange={setOtp} />
      </Group>

      <Group title="Range slider" p={p}>
        <PontesSlider
          p={p} font={font}
          label="Limite mensal"
          min={0} max={8000}
          value={sliderV}
          onChange={setSliderV}
          formatValue={(v) => `R$ ${v.toLocaleString("pt-BR")}`}
        />
      </Group>

      <Group title="Date picker" p={p}>
        <PontesDatePicker p={p} font={font} value={date} onChange={setDate} events={[new Date(2026, 4, 10), new Date(2026, 4, 18), new Date(2026, 4, 25)]} />
      </Group>

      <Group title="File upload" p={p}>
        <PontesFileDrop p={p} font={font} title="Arraste seu arquivo OFX aqui" formats="OFX, CSV, QIF · até 10MB" onFiles={() => { /* noop */ }} />
      </Group>

      <Group title="Tag input" p={p}>
        <PontesTagInput p={p} font={font} tags={tags} onChange={setTags} />
      </Group>

      <Group title="Color picker" p={p}>
        <PontesColorPicker
          p={p}
          value={color}
          onChange={setColor}
          colors={[p.primary, p.accent, "#10B981", "#F59E0B", "#DC2626", "#3B82F6", "#A855F7", "#EC4899", "#14B8A6", "#64748B"]}
        />
      </Group>

      <Group title="Rating estrelas" p={p}>
        <PontesRating p={p} font={font} value={rating} onChange={setRating} />
      </Group>

      <Group title="Kbd atalhos" p={p}>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
          <PontesKbdGroup p={p} font={font} keys={["⌘", "K"]} label="Busca rápida" />
          <PontesKbdGroup p={p} font={font} keys={["⌘", "N"]} label="Nova transação" />
          <PontesKbdGroup p={p} font={font} keys={["G", "D"]} label="Dashboard" />
          <PontesKbdGroup p={p} font={font} keys={["?"]} label="Atalhos" />
          <PontesKbdGroup p={p} font={font} keys={["Esc"]} label="Fechar" />
        </div>
        {/* Kbd single (tecla isolada) */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <PontesKbd p={p}>⌘</PontesKbd>
          <PontesKbd p={p}>⇧</PontesKbd>
          <PontesKbd p={p}>Enter</PontesKbd>
        </div>
      </Group>

      <Group title="Toggle, Checkbox, Radio" p={p}>
        <div style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" }}>
          <PontesToggle p={p} font={font} checked={notif} onChange={setNotif} label="Notificações" />
          <PontesToggle p={p} font={font} checked={dark} onChange={setDark} label="Modo escuro" />
          <PontesCheckbox p={p} font={font} checked={remember} onChange={setRemember} label="Lembrar acesso" />
          <PontesCheckbox p={p} font={font} checked={terms} onChange={setTerms} label="Aceitar termos" />
          <PontesRadioGroup
            p={p} font={font}
            value={period}
            onChange={setPeriod}
            options={[{ value: "mensal", label: "Mensal" }, { value: "anual", label: "Anual" }]}
          />
        </div>
      </Group>
    </div>
  )
}

// =============================================================================
// DATA SECTION
// =============================================================================

function DataSection({ p, font }: { p: Palette; font: string }) {
  type Row = { date: string; desc: string; cat: string; account: string; member: string; v: number }
  const rows: Row[] = [
    { date: "20/05", desc: "Mercado Pão de Açúcar", cat: "Mercado", account: "Nubank", member: "G", v: -142.30 },
    { date: "20/05", desc: "Salário Gustavo", cat: "Renda", account: "Itaú", member: "G", v: 4200 },
    { date: "19/05", desc: "Netflix", cat: "Lazer", account: "Nubank", member: "G", v: -55.90 },
    { date: "19/05", desc: "Conta de Luz · rateada", cat: "Casa", account: "Itaú", member: "G+M", v: -240 },
    { date: "18/05", desc: "iFood", cat: "Alimentação", account: "Nubank", member: "M", v: -68.50 },
  ]

  return (
    <div>
      <Group title="Badges (chips)" p={p}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <PontesBadge p={p} font={font} tone="primary">Família</PontesBadge>
          <PontesBadge p={p} font={font} tone="accent">Pro</PontesBadge>
          <PontesBadge p={p} font={font} tone="soft">Pendente</PontesBadge>
          <PontesBadge p={p} font={font} tone="success">Pago</PontesBadge>
          <PontesBadge p={p} font={font} tone="danger">Atrasado</PontesBadge>
          <PontesBadge p={p} font={font} tone="warning">Vence hoje</PontesBadge>
          <PontesBadge p={p} font={font} tone="neutral">Mercado</PontesBadge>
          <PontesBadge p={p} font={font} tone="outline">Outline</PontesBadge>
        </div>
      </Group>

      <Group title="Avatares + Stack" p={p}>
        <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
          <PontesAvatar p={p} size={32} name="Gustavo Pontes" />
          <PontesAvatar p={p} size={40} name="Maria Silva" status="online" bg={p.accent} fg="#0B1220" />
          <PontesAvatar p={p} size={48} name="Lucas P" status="away" />
          <PontesAvatar p={p} size={56} name="+3" status="busy" bg="#94A3B8" />
          <PontesAvatarStack p={p} avatars={[
            { name: "G", bg: p.primary }, { name: "M", bg: p.accent },
            { name: "L", bg: "#94A3B8" }, { name: "B", bg: "#22C55E" },
          ]} />
          <PontesAvatar p={p} size={40} name="BR" rounded="square" />
        </div>
      </Group>

      <Group title="Alerts / Banners" p={p}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <PontesAlert p={p} font={font} tone="info" title="Info">Sua fatura fecha em 3 dias.</PontesAlert>
          <PontesAlert p={p} font={font} tone="success" title="Pago">Conta de luz paga com sucesso.</PontesAlert>
          <PontesAlert p={p} font={font} tone="warning" title="Atenção">Limite do cartão em 85%.</PontesAlert>
          <PontesAlert p={p} font={font} tone="error" title="Erro">Não foi possível conectar com o banco.</PontesAlert>
        </div>
      </Group>

      <Group title="Progress bars" p={p}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <PontesProgress p={p} font={font} label="Meta de viagem" value={45} />
          <PontesProgress p={p} font={font} label="Limite usado" value={78} color={p.accent} />
          <PontesProgress p={p} font={font} label="Reserva de emergência" value={92} color={semantic.success} />
        </div>
      </Group>

      <Group title="Stat cards" p={p}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          <PontesStatCard p={p} font={font} label="Saldo total" value="R$ 31.970" trend="+12.4%" trendUp />
          <PontesStatCard p={p} font={font} label="Despesas mês" value="R$ 5.140" trend="-3.1%" trendUp={false} />
          <PontesStatCard p={p} font={font} label="Receitas mês" value="R$ 8.200" trend="+5.8%" trendUp />
          <PontesStatCard p={p} font={font} label="Economia" value="R$ 3.060" trend="+8.2%" trendUp />
        </div>
      </Group>

      <Group title="Card (surface primitivo)" p={p}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          <PontesCard p={p}>Card simples</PontesCard>
          <PontesCard p={p} shadow="md">Card com sombra</PontesCard>
          <PontesCard p={p} dashed>Card tracejado</PontesCard>
        </div>
      </Group>

      <Group title="Tabela" p={p}>
        <PontesTable<Row>
          p={p} font={font}
          title="Transações de maio"
          subtitle="247 lançamentos · R$ 5.140,00 em despesas"
          toolbar={<>
            <PontesButton p={p} font={font} size="sm" variant="outline">Filtros</PontesButton>
            <PontesButton p={p} font={font} size="sm" iconStart={<Plus size={16} strokeWidth={2.5} />}>Nova</PontesButton>
          </>}
          columns={[
            { key: "date", header: "Data ↓", render: (r) => <span style={{ color: p.textMuted, fontSize: 12 }}>{r.date}</span> },
            { key: "desc", header: "Descrição", render: (r) => <span style={{ fontWeight: 600 }}>{r.desc}</span> },
            { key: "cat", header: "Categoria", render: (r) => <PontesBadge p={p} font={font} tone="soft" size="sm">{r.cat}</PontesBadge> },
            { key: "account", header: "Conta", render: (r) => <span style={{ color: p.textMuted, fontSize: 12 }}>{r.account}</span> },
            { key: "member", header: "Membro", render: (r) => <PontesBadge p={p} font={font} tone="accent" size="sm">{r.member}</PontesBadge> },
            { key: "v", header: "Valor", align: "right" as const, render: (r) => (
              <span style={{ color: r.v > 0 ? "#16A34A" : "#DC2626", fontWeight: 700 }}>
                {r.v > 0 ? "+ " : "- "}R$ {Math.abs(r.v).toFixed(2).replace(".", ",")}
              </span>
            ) },
          ]}
          rows={rows}
          footer={<span>Mostrando 5 de 247</span>}
        />
      </Group>
    </div>
  )
}

// =============================================================================
// FEEDBACK SECTION
// =============================================================================

function FeedbackSection({ p, font }: { p: Palette; font: string }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [cmdkOpen, setCmdkOpen] = useState(false)
  const [cmdkQ, setCmdkQ] = useState("luz")

  return (
    <div>
      <Group title="Toast notifications" p={p}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 380 }}>
          <PontesToast p={p} font={font} tone="success" title="Despesa salva" description="R$ 142,30 · Mercado · Nubank" time="agora" />
          <PontesToast p={p} font={font} tone="info" title="Maria comentou" description="Sobre a conta de luz" time="1 min" />
          <PontesToast p={p} font={font} tone="warning" title="Limite do cartão" description="Atingiu 85% do limite Nubank" time="5 min" />
          <PontesToast p={p} font={font} tone="error" title="Erro ao sincronizar" description="Tentando reconectar..." time="10 min" />
        </div>
      </Group>

      <Group title="Modal & Dialog & Drawer" p={p}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <PontesButton p={p} font={font} onClick={() => setModalOpen(true)}>Abrir modal</PontesButton>
          <PontesButton p={p} font={font} variant="danger" onClick={() => setDialogOpen(true)}>Diálogo de confirmação</PontesButton>
          <PontesButton p={p} font={font} variant="outline" onClick={() => setDrawerOpen(true)}>Abrir drawer</PontesButton>
          <PontesButton p={p} font={font} variant="ghost" onClick={() => setCmdkOpen(true)}>Abrir Cmd+K</PontesButton>
        </div>

        <PontesModal
          p={p} font={font} open={modalOpen} title="Nova transação" onClose={() => setModalOpen(false)}
          footer={<>
            <PontesButton p={p} font={font} variant="outline" onClick={() => setModalOpen(false)}>Cancelar</PontesButton>
            <PontesButton p={p} font={font} onClick={() => setModalOpen(false)}>Salvar transação</PontesButton>
          </>}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <PontesField p={p} font={font} label="Descrição">
              <PontesInput p={p} font={font} placeholder="Ex: Almoço com Maria" />
            </PontesField>
            <PontesField p={p} font={font} label="Valor">
              <PontesInput p={p} font={font} style={{ fontSize: 24, fontWeight: 700 }} defaultValue="R$ 0,00" />
            </PontesField>
          </div>
        </PontesModal>

        <PontesDialog
          p={p} font={font} open={dialogOpen}
          title="Excluir transação?"
          description="Esta ação não pode ser desfeita. A transação será removida permanentemente."
          confirmLabel="Sim, excluir"
          onConfirm={() => setDialogOpen(false)}
          onCancel={() => setDialogOpen(false)}
        />

        <PontesDrawer
          p={p} font={font} open={drawerOpen} title="Detalhes da transação" onClose={() => setDrawerOpen(false)}
          footer={<PontesButton p={p} font={font} fullWidth>Salvar</PontesButton>}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <PontesCard p={p} padding={14}>
              <div style={{ fontSize: 11, fontWeight: 700, color: p.textMuted, letterSpacing: "0.1em", marginBottom: 4, textTransform: "uppercase" }}>Valor</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: semantic.danger }}>- R$ 142,30</div>
            </PontesCard>
            <PontesField p={p} font={font} label="Descrição">
              <PontesInput p={p} font={font} defaultValue="Mercado Pão de Açúcar" />
            </PontesField>
            <PontesField p={p} font={font} label="Conta">
              <PontesInput p={p} font={font} defaultValue="Nubank · final 4218" />
            </PontesField>
          </div>
        </PontesDrawer>

        <PontesCommandPalette
          p={p} font={font} open={cmdkOpen}
          onClose={() => setCmdkOpen(false)}
          query={cmdkQ} onQueryChange={setCmdkQ}
          items={[
            { key: "1", icon: "⚡", label: "Conta de luz · R$ 240,00", hint: "Transação · 18/05", onSelect: () => undefined },
            { key: "2", icon: "💡", label: "Categoria: Energia elétrica", hint: "Ir pra categoria", onSelect: () => undefined },
            { key: "3", icon: "✦", label: "Nova despesa — Conta de luz", hint: "Ação rápida", onSelect: () => undefined },
          ]}
        />
      </Group>

      <Group title="Skeleton (loading)" p={p}>
        <div style={{ maxWidth: 480, marginBottom: 16 }}>
          <PontesSkeletonList p={p} rows={3} />
        </div>
        {/* Skeleton blocks individuais */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 480 }}>
          <PontesSkeleton p={p} width="80%" height={16} />
          <PontesSkeleton p={p} width="60%" height={12} />
          <PontesSkeleton p={p} width={120} height={36} radius={10} />
        </div>
      </Group>

      <Group title="Empty state" p={p}>
        <PontesEmptyState
          p={p} font={font}
          icon="📭"
          title="Nenhuma transação ainda"
          description="Adicione manualmente ou conecte uma conta pra importar tudo."
          actions={<>
            <PontesButton p={p} font={font} size="sm" iconStart={<Plus size={16} strokeWidth={2.5} />}>Nova transação</PontesButton>
            <PontesButton p={p} font={font} size="sm" variant="outline">Conectar banco</PontesButton>
          </>}
        />
      </Group>

      <Group title="Loading dots" p={p}>
        <PontesLoadingDots p={p} />
      </Group>

      <Group title="Tooltip / Popover" p={p}>
        <div style={{ display: "flex", gap: 40, alignItems: "center", padding: 40, background: p.surface, borderRadius: 14, border: `1px solid ${p.border}` }}>
          <PontesTooltip p={p} font={font} label="Atalho: ⌘N">
            <PontesButton p={p} font={font}>Hover sobre mim</PontesButton>
          </PontesTooltip>

          <PontesPopover
            p={p} font={font}
            trigger={<PontesButton p={p} font={font} variant="outline" iconStart={<MoreHorizontal size={16} strokeWidth={2.5} />}>Mais ações</PontesButton>}
            items={[
              { key: "edit", icon: <Pencil size={14} />, label: "Editar" },
              { key: "duplicate", icon: <Copy size={14} />, label: "Duplicar" },
              { key: "share", icon: <Share2 size={14} />, label: "Compartilhar" },
              { key: "delete", icon: <Trash2 size={14} />, label: "Excluir", danger: true, divider: true },
            ]}
          />
        </div>
      </Group>
    </div>
  )
}

// =============================================================================
// NAV SECTION
// =============================================================================

function NavSection({ p, font }: { p: Palette; font: string }) {
  const [pillTab, setPillTab] = useState<"visao" | "transacoes" | "categorias" | "relatorios">("visao")
  const [underTab, setUnderTab] = useState<"transacoes" | "faturas" | "recorrentes" | "parcelamentos">("transacoes")
  const [page, setPage] = useState(3)

  return (
    <div>
      <Group title="Breadcrumb" p={p}>
        <PontesBreadcrumb p={p} font={font} items={[
          { label: "Início" }, { label: "Família" }, { label: "Membros" }, { label: "Maria Silva" },
        ]} />
      </Group>

      <Group title="Tabs — pills" p={p}>
        <PontesTabs<"visao" | "transacoes" | "categorias" | "relatorios">
          p={p} font={font}
          value={pillTab} onChange={setPillTab}
          options={[
            { value: "visao", label: "Visão geral" },
            { value: "transacoes", label: "Transações" },
            { value: "categorias", label: "Categorias" },
            { value: "relatorios", label: "Relatórios" },
          ]}
        />
      </Group>

      <Group title="Tabs — underline" p={p}>
        <PontesTabs<"transacoes" | "faturas" | "recorrentes" | "parcelamentos">
          p={p} font={font}
          variant="underline"
          value={underTab} onChange={setUnderTab}
          options={[
            { value: "transacoes", label: "Transações" },
            { value: "faturas", label: "Faturas" },
            { value: "recorrentes", label: "Recorrentes" },
            { value: "parcelamentos", label: "Parcelamentos" },
          ]}
        />
      </Group>

      <Group title="Stepper" p={p}>
        <PontesStepper
          p={p} font={font}
          steps={[
            { label: "Dados", status: "done" },
            { label: "Categoria", status: "done" },
            { label: "Confirmação", status: "current" },
            { label: "Pronto" },
          ]}
        />
      </Group>

      <Group title="Pagination" p={p}>
        <PontesPagination
          p={p} font={font}
          page={page}
          totalPages={24}
          onChange={setPage}
          totalLabel="Mostrando 21–30 de 240"
        />
      </Group>
    </div>
  )
}

// =============================================================================
// SITE SECTION — componentes full-width do site público
// =============================================================================

function SiteSection({ p, font }: { p: Palette; font: string }) {
  return (
    <div>
      <Group title="Navbar (fixed sobre hero — preview estático)" p={p}>
        {/* Navbar é position:fixed. Aqui mostramos num container relativo com hero
            simulado pra dar contexto. Versão ao vivo: /site e /site/casais. */}
        <div style={{ position: "relative", height: 200, borderRadius: 14, overflow: "hidden", background: `linear-gradient(135deg, ${p.primaryDark}, ${p.primary})` }}>
          <div style={{ position: "absolute", inset: 0, transform: "scale(1)" }}>
            <NavbarPreview p={p} font={font} />
          </div>
          <div style={{ position: "absolute", bottom: 16, left: 24, color: p.heroFg, opacity: 0.8, fontSize: 13 }}>
            Hero simulado · navbar glass por cima
          </div>
        </div>
        <div style={{ fontSize: 12, color: p.textMuted, marginTop: 10 }}>
          Ao vivo: <PontesLink p={p} font={font} href="/site">/site</PontesLink> e <PontesLink p={p} font={font} href="/site/casais">/site/casais</PontesLink>
        </div>
      </Group>

      <Group title="Footer — variant rich (4 colunas + brand + app badges)" p={p}>
        <div style={{ borderRadius: 14, overflow: "hidden" }}>
          <PontesFooter
            p={p} font={font} variant="rich"
            onNavigate={() => undefined}
            appBadges={[{ label: "App Store" }, { label: "Google Play" }]}
          />
        </div>
      </Group>

      <Group title="Footer — variant minimal (linha única)" p={p}>
        <div style={{ borderRadius: 14, overflow: "hidden" }}>
          <PontesFooter p={p} font={font} variant="minimal" onNavigate={() => undefined} />
        </div>
      </Group>
    </div>
  )
}

/** Navbar com posicionamento absolute (override do fixed) pra caber no preview do DS. */
function NavbarPreview({ p, font }: { p: Palette; font: string }) {
  return (
    <div style={{ position: "absolute", top: 16, left: 0, right: 0 }}>
      {/* Reusa visual do PontesNavbar via wrapper que neutraliza o fixed.
          Mostramos uma cópia estática dos elementos pra não conflitar com o fixed global. */}
      <div style={{ display: "flex", justifyContent: "center", padding: "0 24px" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 32,
          padding: "10px 16px 10px 22px", background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.2)", borderRadius: 999,
          backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
          minWidth: 760, maxWidth: 900, width: "100%",
        }}>
          <span style={{ color: p.heroFg, fontWeight: 800, fontSize: 18, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Pontes</span>
          <div style={{ display: "flex", gap: 22 }}>
            <PontesNavLink p={p} font={font} color={p.heroFg} hoverColor={p.accent} active>Recursos</PontesNavLink>
            <PontesNavLink p={p} font={font} color={p.heroFg} hoverColor={p.accent}>Para Casais</PontesNavLink>
            <PontesNavLink p={p} font={font} color={p.heroFg} hoverColor={p.accent}>Sobre</PontesNavLink>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <PontesButton p={p} font={font} variant="outline-light" size="sm" style={{ borderRadius: 999 }}>Entrar</PontesButton>
            <PontesButton p={p} font={font} variant="accent" size="sm" style={{ borderRadius: 999 }}>Criar conta</PontesButton>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// TOKENS SECTION (paleta atual + tipografia)
// =============================================================================

function TokensSection({ p, font }: { p: Palette; font: string }) {
  const tokens: { key: keyof Palette; label: string }[] = [
    { key: "primary", label: "primary" },
    { key: "primaryDark", label: "primaryDark" },
    { key: "primarySoft", label: "primarySoft" },
    { key: "accent", label: "accent" },
    { key: "accentSoft", label: "accentSoft" },
    { key: "text", label: "text" },
    { key: "textMuted", label: "textMuted" },
    { key: "bg", label: "bg" },
    { key: "surface", label: "surface" },
    { key: "border", label: "border" },
  ]

  return (
    <div>
      <Group title="Cores da paleta atual" p={p}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
          {tokens.map((t) => (
            <div key={t.key} style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ height: 64, background: p[t.key] }} />
              <div style={{ padding: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: p.text }}>{t.label}</div>
                <div style={{ fontSize: 10, color: p.textMuted, fontFamily: "monospace" }}>{p[t.key]}</div>
              </div>
            </div>
          ))}
        </div>
      </Group>

      <Group title="Tipografia" p={p}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: font }}>
          <div style={{ fontSize: 56, fontWeight: 600, color: p.text, fontFamily: "'Fraunces', serif", letterSpacing: "-0.025em", lineHeight: 1.05 }}>H1 Fraunces 56/600</div>
          <div style={{ fontSize: 42, fontWeight: 600, color: p.text, fontFamily: "'Fraunces', serif", letterSpacing: "-0.02em" }}>H2 Fraunces 42/600</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: p.text }}>H3 Sans 28/700</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: p.text }}>H4 Sans 18/600</div>
          <div style={{ fontSize: 14, color: p.text }}>Body Sans 14/400 — texto padrão de UI.</div>
          <div style={{ fontSize: 12, color: p.textMuted }}>Caption Sans 12/400 — secundário.</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: p.textMuted, letterSpacing: "0.18em", textTransform: "uppercase" }}>Eyebrow 11/700 LETRA-SPACED</div>
        </div>
      </Group>

      <Group title="Semânticas (independentes de paleta)" p={p}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {[
            { name: "success", color: semantic.success, soft: semantic.successSoft },
            { name: "warning", color: semantic.warning, soft: semantic.warningSoft },
            { name: "danger", color: semantic.danger, soft: semantic.dangerSoft },
            { name: "info", color: semantic.info, soft: semantic.infoSoft },
          ].map((t) => (
            <div key={t.name} style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ height: 48, background: t.color }} />
              <div style={{ height: 24, background: t.soft }} />
              <div style={{ padding: 10, fontSize: 12, fontWeight: 700 }}>{t.name}</div>
            </div>
          ))}
        </div>
      </Group>
    </div>
  )
}
