// Trava do PACOTE (roda no fim do `npm run build`): o script inline do index.html (tema antes do 1º desenho) só roda em
// produção se o hash dele estiver no CSP do Caddyfile (script-src 'self' 'sha256-…'). Mudou o script, muda o hash:
// este script confere e, se não bater, falha o build e diz o hash certo pra pôr no Caddyfile.
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"

const raiz = path.resolve(import.meta.dirname, "..")
const html = readFileSync(path.join(raiz, "dist", "index.html"), "utf8")
const caddy = readFileSync(path.join(raiz, "Caddyfile"), "utf8")

const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1])
const hashes = inline.map((c) => "sha256-" + createHash("sha256").update(c, "utf8").digest("base64"))
const csp = caddy.match(/script-src ([^;]*);/)?.[1] ?? ""
const faltam = hashes.filter((h) => !csp.includes(`'${h}'`))

if (faltam.length) {
  console.error("Script inline do index.html sem hash no CSP do Caddyfile (em produção ele não rodaria):\n" + faltam.map((h) => `  '${h}'`).join("\n") + "\nPõe no script-src do Caddyfile.")
  process.exit(1)
}
console.log(`csp do script inline: ok (${inline.length} script, hash no Caddyfile)`)
