// Trava do PACOTE (roda no fim do `npm run build`): a barra de estados do dev (src/dev/) e os exemplos dela nunca vão
// pra produção, nem escondidos. Procura em TUDO que saiu no dist (js, css, html) as marcas que só existem nesse código.
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

const dist = path.resolve(import.meta.dirname, "..", "dist")

// Marcas só do painel de dev: o rótulo de acessibilidade, a chave dele, o componente, os estados e os exemplos.
const MARCAS = [
  /Painel de dev \(só em desenvolvimento\)/, /Contas de teste \(preenche o login\)/, /dev:barraEstados/, /BarraEstadosDev/, /Contas salvas/, /Link vencido/,
  /Pedido enviado"/, /Ativar 2 etapas/, /Ana Souza/, /4F7K-92QA/, /JBSWY3DPEHPK3PXP/, /redefinir-senha\?token=dev/, /Sem sair por inatividade/, /ManterVivoDev/, /Desenho do Importar/, /CONSTRUTORA ALVORADA/, /Extrato-Banco-Exemplo/, /PADARIA PAO DOURADO/, /Tipo em coluna própria/, /Mapa do Importar/, /Leva pra outra tela/,
]

const arquivos = []
const andar = (dir) => {
  for (const nome of readdirSync(dir)) {
    const caminho = path.join(dir, nome)
    if (statSync(caminho).isDirectory()) andar(caminho)
    else if (/\.(js|css|html)$/.test(nome)) arquivos.push(caminho)
  }
}
andar(dist)

const achados = []
for (const arq of arquivos) {
  const codigo = readFileSync(arq, "utf8")
  for (const marca of MARCAS) if (marca.test(codigo)) achados.push(`${path.relative(dist, arq)}: ${marca}`)
}
if (arquivos.length === 0) achados.push("dist vazio (a trava não achou o que conferir)")

if (achados.length) {
  console.error("Código só de dev vazou pro build:\n" + achados.join("\n"))
  process.exit(1)
}
console.log(`dev fora do build: ok (${arquivos.length} arquivos conferidos)`)
