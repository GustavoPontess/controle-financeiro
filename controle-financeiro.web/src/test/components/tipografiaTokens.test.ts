// Trava da escala de tipografia (2026-10-05): tamanho de letra nos componentes do DS sai de
// `--pontes-fs-*` (tokens.css). Quem escrever `font-size: 13px` num componente novo quebra este teste.
// Exceções: ícone/glifo (não é texto) e os poucos tamanhos especiais listados em PERMITIDOS.
/// <reference types="node" />
import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

// Lê do disco (o vitest esvazia CSS importado, inclusive com ?raw). cwd = raiz do front.
const PONTES = join(process.cwd(), "src", "components", "pontes")
const tokensCss = readFileSync(join(PONTES, "styles", "tokens.css"), "utf8")
const listarCss = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listarCss(join(dir, e.name)) : e.name.endsWith(".module.css") ? [join(dir, e.name)] : [])
const cssDosComponentes: Record<string, string> = Object.fromEntries(
  listarCss(PONTES).map((f) => [f.replace(/\\/g, "/"), readFileSync(f, "utf8")]))

// TELAS (pages + components fora do DS). Fora: site público (tamanhos de landing), vitrine do DS e as
// galerias DEV da reconciliação (vão ser apagadas).
const SRC = join(process.cwd(), "src")
const listarCssTela = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listarCssTela(join(dir, e.name)) : e.name.endsWith(".css") ? [join(dir, e.name)] : [])
const cssDasTelas: Record<string, string> = Object.fromEntries(
  [...listarCssTela(join(SRC, "pages")), ...listarCssTela(join(SRC, "components"))]
    .map((f) => f.replace(/\\/g, "/"))
    .filter((f) => !/\/(Site|DesignSystem)\//.test(f) && !/ReconciliacaoModelos|ReconciliacaoEstados/.test(f) && !f.includes("/components/pontes/"))
    .map((f) => [f, readFileSync(f, "utf8")]))


// "Arquivo | seletor" que podem ter px. Ícone/glifo + tamanhos especiais fora da escala.
const PERMITIDOS = new Set([
  'Button.module.css | .iconBtn[data-size="24"]',
  'Button.module.css | .iconBtn[data-size="32"]',
  'Button.module.css | .iconBtn[data-size="40"]',
  'Button.module.css | .iconBtn[data-size="48"]',
  'Button.module.css | .fab[data-size="48"]',
  'Button.module.css | .fab[data-size="56"]',
  'Button.module.css | .fab[data-size="64"]',
  "Alert.module.css | .icon",
  "Alert.module.css | .close",
  "CategoryDonut.module.css | .totalLabel", // rosca bem pequena (container < 220px)
  "Drawer.module.css | .close",
  "EmptyState.module.css | .icon",
  "Modal.module.css | .dialogIcon",
  "Toast.module.css | .icon",
  "Toast.module.css | .close",
  "DatePicker.module.css | .nav",
  "FileDrop.module.css | .icon",
  "FileDrop.module.css | .title",
  "Input.module.css | .moneyCur", // campo de dinheiro grande (clamp responsivo)
  "Input.module.css | .moneyInput",
  "Otp.module.css | .cell", // dígito do código
  "TagInput.module.css | .remove",
  "CommandPalette.module.css | .searchIcon",
  "CommandPalette.module.css | .input",
  "CommandPalette.module.css | .itemIcon",
])

// Cada `font-size` literal (px/clamp) com o seletor da regra onde está.
function tamanhosLiterais(arquivo: string, css: string) {
  const semComentario = css.replace(/\/\*[\s\S]*?\*\//g, "")
  const nome = arquivo.split("/").pop()!
  const achados: string[] = []
  for (const m of semComentario.matchAll(/font-size:\s*(?:[\d.]+px|clamp\([^)]*\))/g)) {
    const abre = semComentario.lastIndexOf("{", m.index)
    const fechaAnterior = semComentario.lastIndexOf("}", abre)
    const seletor = semComentario.slice(fechaAnterior + 1, abre).trim().replace(/\s+/g, " ")
    achados.push(`${nome} | ${seletor}`)
  }
  return achados
}

describe("escala de tipografia (--pontes-fs-*)", () => {
  it("tokens.css define a escala e os papéis", () => {
    for (const degrau of ["2xs", "xs", "sm", "md", "base", "lg", "xl", "2xl", "3xl"]) {
      expect(tokensCss).toMatch(new RegExp(`--pontes-fs-${degrau}:\\s*[\\d.]+px;`))
    }
    for (const papel of [
      "rotulo", "linha", "secundario", "corpo", "controle", "titulo-painel",
      "titulo-caixa", "titulo-modal", "titulo-pagina", "stat-valor", "hero-valor", "hero-numero",
    ]) {
      expect(tokensCss).toMatch(new RegExp(`--pontes-fs-${papel}:`))
    }
  })

  it("componentes do DS não escrevem tamanho de letra na mão (fora ícone/glifo e as exceções listadas)", () => {
    const arquivos = Object.entries(cssDosComponentes).filter(([f]) => !f.includes("/pontes/site/"))
    expect(arquivos.length).toBeGreaterThan(30) // o glob achou os CSS mesmo
    const fora = arquivos.flatMap(([f, css]) => tamanhosLiterais(f, css)).filter((k) => !PERMITIDOS.has(k))
    expect(fora).toEqual([])
  })

  it("todo token usado nos componentes existe no tokens.css", () => {
    const usados = new Set(
      Object.values(cssDosComponentes).flatMap((css) => [...css.matchAll(/var\(--pontes-fs-([a-z0-9-]+)\)/g)].map((m) => m[1])),
    )
    expect(usados.size).toBeGreaterThan(5)
    for (const t of usados) expect(tokensCss).toContain(`--pontes-fs-${t}:`)
  })

  it("telas não escrevem tamanho de letra na mão (zero px/rem — tudo via --pontes-fs-*)", () => {
    const arquivos = Object.entries(cssDasTelas)
    expect(arquivos.length).toBeGreaterThan(25) // achou os CSS das telas mesmo
    // rem conta igual a px (Limites/Metas usavam rem)
    const achados = arquivos.flatMap(([f, css]) => tamanhosLiterais(f, css.replace(/font-size:\s*([\d.]+)rem/g, "font-size: $1px")))
    expect(achados).toEqual([])
  })

  it("todo token usado nas telas existe no tokens.css", () => {
    const usados = new Set(
      Object.values(cssDasTelas).flatMap((css) => [...css.matchAll(/var\(--pontes-fs-([a-z0-9-]+)\)/g)].map((m) => m[1])),
    )
    expect(usados.size).toBeGreaterThan(5)
    for (const t of usados) expect(tokensCss).toContain(`--pontes-fs-${t}:`)
  })
})
