// PostToolUse (Edit|Write) — trava do padrão de telas pro Claude (qualquer modelo).
//  - Tela interna ou componente do DS (.tsx): roda o ESLint só no arquivo editado. Se quebrar a
//    regra, sai com código 2 e o erro vai pro modelo corrigir na hora (não espera o CI).
//  - Tela interna: lembra a receita (skill pontes-telas) via additionalContext.
//  - Formulário (*Form*/*Dialog*): lembra a regra de validação.
// Saída normal (exit 0 + stdout) de PostToolUse NÃO chega ao modelo; por isso JSON/exit 2.
const { spawnSync } = require("node:child_process")
const path = require("node:path")

const RAIZ = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, "..", "..")
const WEB = path.join(RAIZ, "controle-financeiro.web")
const FORA = /\/src\/pages\/(Site|DesignSystem|Auth|Convite|Onboarding)\//

const REGRA_FORM =
  "REGRA FORM: validar por campo antes de enviar e bloquear se inválido; erro via PontesField error= + invalid " +
  "(nunca toast pra campo); erro limpa ao editar; mensagem != placeholder; dinheiro só com PontesMoneyInput; " +
  "Idempotency-Key gerada ao abrir o modal; teste obrigatório (envio vazio bloqueia e mostra erros)."
const REGRA_TELA =
  "TELA INTERNA: siga a skill pontes-telas (4 blocos, anatomia do item, ⋮ com destrutivo confirmado, busca/filtro " +
  "no servidor) e a ficha da entidade em docs/features/padrao-telas/ficha-por-entidade.md. Antes de terminar: " +
  "npm run build + /revisar-usabilidade nos arquivos."

let entrada = ""
process.stdin.on("data", (d) => (entrada += d)).on("end", () => {
  let arquivo = ""
  try {
    const j = JSON.parse(entrada)
    arquivo = ((j.tool_input && j.tool_input.file_path) || "").replace(/\\/g, "/")
  } catch {
    process.exit(0) // entrada malformada: não trava nada
  }
  if (!/\.tsx$/.test(arquivo) || !arquivo.includes("/controle-financeiro.web/src/")) process.exit(0)

  const ehTela = arquivo.includes("/src/pages/") && !FORA.test(arquivo)
  const ehDs = arquivo.includes("/src/components/pontes/")
  const ehForm = /(Form|Dialog)[^/]*\.tsx$/.test(arquivo)

  if (ehTela || ehDs) {
    const r = spawnSync(process.execPath, [path.join(WEB, "node_modules", "eslint", "bin", "eslint.js"), arquivo], {
      cwd: WEB, encoding: "utf8", timeout: 60000,
    })
    if (r.status === 1) {
      process.stderr.write(
        `ESLint barrou ${path.basename(arquivo)} (padrão de telas). Corrija antes de seguir:\n${r.stdout || r.stderr}`
      )
      process.exit(2)
    }
  }

  const avisos = []
  if (ehTela) avisos.push(REGRA_TELA)
  if (ehForm) avisos.push(REGRA_FORM)
  if (avisos.length) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: avisos.join("\n") },
    }))
  }
  process.exit(0)
})
