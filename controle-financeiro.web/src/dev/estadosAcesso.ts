// Estados das telas de acesso pra barra de dev (os mesmos da barra do rascunho). Só usar dentro de `import.meta.env.DEV &&`.
import type { GruposEstadosDev } from "./tipos"

export const ESTADOS_ACESSO: GruposEstadosDev = [
  [
    { rotulo: "Entrar", para: "/entrar#entrar" },
    { rotulo: "Contas salvas", para: "/entrar#contas" },
    { rotulo: "Duas etapas", para: "/entrar#duas-etapas" },
    { rotulo: "Esqueci a senha", para: "/entrar#esqueci" },
    { rotulo: "Link enviado", para: "/entrar#link-enviado" },
    { rotulo: "Reativar", para: "/entrar#reativar" },
  ],
  [
    { rotulo: "Pedir acesso", para: "/cadastro#pedir" },
    { rotulo: "Pedido enviado", para: "/cadastro#enviado" },
    { rotulo: "Nova senha", para: "/redefinir-senha?token=dev#nova" },
    { rotulo: "Senha alterada", para: "/redefinir-senha?token=dev#alterada" },
    { rotulo: "Link vencido", para: "/redefinir-senha#invalido" },
    { rotulo: "Proteja a conta", para: "/proteja-sua-conta#proteja" },
    { rotulo: "Ativar 2 etapas", para: "/proteja-sua-conta#ativar" },
    { rotulo: "Códigos", para: "/proteja-sua-conta#codigos" },
  ],
]

/** Contas de exemplo pro passo "Contas salvas" quando o navegador não tem nenhuma (as do rascunho). */
export const CONTAS_EXEMPLO = [
  { usuarioId: "dev-ana", nome: "Ana Souza", emailMascarado: "a•••••@gmail.com" },
  { usuarioId: "dev-rafael", nome: "Rafael Lima", emailMascarado: "r•••••@outlook.com" },
]

/** Códigos de recuperação de exemplo (os do rascunho). */
export const CODIGOS_EXEMPLO = ["4F7K-92QA", "XM3P-71DD", "8RTZ-05LW", "Q2NB-66HC", "V9JE-38SK", "T1GY-24MX"]
