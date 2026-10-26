// Trava do PACOTE (roda no fim do `npm run build`): o que o app comum baixa (index.html e tudo que ele alcança, por
// import estático ou dinâmico) não pode ter nada do mini-app de admin. Complementa src/test/adminForaDoPacoteComum.
import { readFileSync, existsSync } from "node:fs"
import path from "node:path"

const dist = path.resolve(import.meta.dirname, "..", "dist")
const ler = (rel) => readFileSync(path.join(dist, rel), "utf8")

// Marcas do admin que só existem no código dele: endpoints, o menu e o porteiro.
const MARCAS = [/\/admin\//, /Administra[cç][aã]o/, /admin\.html/, /Ligue as duas etapas/]

const visitados = new Set()
const fila = [...ler("index.html").matchAll(/(?:src|href)="\/([^"]+\.(?:js|css))"/g)].map((m) => m[1])
while (fila.length) {
  const rel = fila.shift()
  if (visitados.has(rel) || !existsSync(path.join(dist, rel))) continue
  visitados.add(rel)
  if (!rel.endsWith(".js")) continue
  const dir = path.posix.dirname(rel)
  for (const m of ler(rel).matchAll(/(?:from\s*|import\s*\(\s*|import\s*)["'](\.{1,2}\/[^"']+\.js)["']/g)) fila.push(path.posix.join(dir, m[1]))
}

const achados = []
for (const rel of visitados) {
  const codigo = ler(rel)
  for (const marca of MARCAS) if (marca.test(codigo)) achados.push(`${rel}: ${marca}`)
}
if (!ler("index.html").includes("<div id=\"root\">") || visitados.size === 0) achados.push("index.html sem o app (a trava não achou o que conferir)")
if (!existsSync(path.join(dist, "admin.html"))) achados.push("admin.html não saiu no build")

if (achados.length) {
  console.error("Admin vazou pro pacote do app:\n" + achados.join("\n"))
  process.exit(1)
}
console.log(`admin fora do pacote do app: ok (${visitados.size} arquivos conferidos)`)
