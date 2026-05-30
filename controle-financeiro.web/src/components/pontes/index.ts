/**
 * Biblioteca Pontes — barrel export.
 * Importe daqui: `import { PontesButton, PontesInput } from "@/components/pontes"`
 *
 * Telas refatoradas no Q5 importam SOMENTE deste pacote.
 * Componentes legados (CustomButton, MUI direto, tokens.ts antigo) ficam fora
 * e serão removidos no fim do ciclo Q5.
 *
 * Estrutura de pastas:
 *   buttons/  — PontesButton, PontesIconButton, PontesFab, etc.
 *   form/     — PontesField, PontesInput, PontesSelect, PontesSlider, etc.
 *   data/     — PontesBadge, PontesAvatar, PontesAlert, PontesTable, etc.
 *   feedback/ — PontesModal, PontesDrawer, PontesToast, PontesSkeleton, etc.
 *   nav/      — PontesTabs, PontesBreadcrumb, PontesPagination, etc.
 *   site/     — PontesNavbar, PontesFooter
 */

// ── Infra / Tokens (raiz) ────────────────────────────────────────────────────
export * from "./theme"
export * from "./_globalStyles"
export * from "./themeContext"
export * from "./ThemeProvider"
export * from "./overlayStyles"
export * from "./useBodyScrollbar"
export * from "./ScrollArea"

// ── Botões ───────────────────────────────────────────────────────────────────
export * from "./buttons/Button"
export * from "./buttons/ChoiceCards"

// ── Formulário & Inputs ──────────────────────────────────────────────────────
export * from "./form/Field"
export * from "./form/Input"
export * from "./form/Select"
export * from "./form/GroupedSelect"
export * from "./form/FormControls"
export * from "./form/Otp"
export * from "./form/Slider"
export * from "./form/DatePicker"
export * from "./form/DateInput"
export * from "./form/FileDrop"
export * from "./form/TagInput"
export * from "./form/ColorPicker"
export * from "./form/Rating"
export * from "./form/Kbd"

// ── Dados & Display ──────────────────────────────────────────────────────────
export * from "./data/Badge"
export * from "./data/Avatar"
export * from "./data/Alert"
export * from "./data/Progress"
export * from "./data/StatCard"
export * from "./data/Card"
export * from "./data/CategoryDonut"
export * from "./data/Table"
export * from "./data/TablePagination"
export * from "./data/BankBadge"

// ── Feedback & Overlays ──────────────────────────────────────────────────────
export * from "./feedback/Toast"
export * from "./feedback/Modal"
export * from "./feedback/Skeleton"
export * from "./feedback/EmptyState"
export * from "./feedback/LoadingDots"
export * from "./feedback/Drawer"
export * from "./feedback/Tooltip"
export * from "./feedback/Popover"

// ── Navegação ────────────────────────────────────────────────────────────────
export * from "./nav/Breadcrumb"
export * from "./nav/Tabs"
export * from "./nav/Stepper"
export * from "./nav/Pagination"
export * from "./nav/CommandPalette"
export * from "./nav/SidebarItem"

// ── Site (componentes full-width do site público) ────────────────────────────
export * from "./site/Navbar"
export * from "./site/Footer"

// ── Logo (re-export para que telas não precisem de import direto) ─────────────
export { default as PontesLogo } from "../Logo/Logo"
export { default as PontesLogoMark } from "../Logo/LogoMark"
