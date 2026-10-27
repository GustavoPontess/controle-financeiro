// Páginas legais: Termos de Uso (/termos-de-uso) e Política de Privacidade (/privacidade), com a roupa do site. Copy portada
// do app atual (2026-08-18/19, fundamentada em docs/CONFORMIDADE_BR.md: LGPD, CDC, Marco Civil). Públicas.
//
// TODO (Gustavo, antes do lançamento público): trocar o "fale com quem te convidou" por um canal de contato de
// verdade (e-mail da empresa) — sem CNPJ/conta de empresa ainda, e-mail pessoal não deve ir pra página pública.
import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import MolduraSite from "../site/MolduraSite"
import styles from "./Legal.module.css"

// Mesmo topo e rodapé do site (MolduraSite); o texto com a fonte e as cores do site.
function PaginaLegal({ titulo, atualizado, beta, children }: { titulo: string; atualizado: string; beta: ReactNode; children: ReactNode }) {
  return (
    <MolduraSite titulo={`${titulo} · Pontes`}>
      <main className={styles.miolo}>
        <span className="olho">Legal</span>
        <h1 className={styles.titulo}>{titulo}</h1>
        <p className={styles.atualizado}>Última atualização: {atualizado}</p>
        <div className={styles.beta}><strong>O Pontes está em beta fechado.</strong> {beta}</div>
        {children}
      </main>
    </MolduraSite>
  )
}

const Secao = ({ titulo, children }: { titulo: string; children: ReactNode }) => (
  <section className={styles.secao}><h2 className={styles.h2}>{titulo}</h2>{children}</section>
)

export function TermosDeUso() {
  return (
    <PaginaLegal titulo="Termos de Uso" atualizado="19 de agosto de 2026"
      beta="Você foi convidado pessoalmente pra testar o produto. O serviço pode mudar, sair do ar ou perder dados durante essa fase. Por enquanto, evite depender do app como único registro do seu histórico financeiro.">
      <Secao titulo="O que é o Pontes">
        <p className={styles.p}>O Pontes é uma ferramenta de <strong>registro manual</strong> de finanças pessoais e familiares, mais parecida com uma planilha do que com um banco digital. Você mesmo digita suas transações, contas e cartões.</p>
        <p className={styles.p}>O Pontes <strong>não</strong> é uma instituição financeira, não se conecta à sua conta bancária real, não movimenta dinheiro, não processa pagamento, não tem custódia de nenhum valor seu e <strong>não</strong> oferece consultoria ou recomendação de investimento. Qualquer decisão financeira que você tomar com base nos números do app é sua, não nossa.</p>
      </Secao>
      <Secao titulo="Sua conta">
        <ul className={styles.lista}>
          <li>Você é responsável por manter sua senha em segredo e por tudo que acontecer na sua conta.</li>
          <li>Os dados que você cadastra (transações, valores, nomes de terceiros em empréstimo) precisam ser verdadeiros: o Pontes não confere a veracidade do que você digita.</li>
          <li>Precisa ter pelo menos 18 anos, ou usar o app com autorização de um responsável.</li>
        </ul>
      </Secao>
      <Secao titulo="Uso aceitável">
        <p className={styles.p}>Não use o Pontes pra atividade ilegal, pra tentar acessar dado de outro usuário sem permissão, nem pra tentar quebrar, sobrecarregar ou comprometer a segurança do serviço. Contas que fizerem isso podem ser suspensas.</p>
      </Secao>
      <Secao titulo="Limites de responsabilidade">
        <p className={styles.p}>O Pontes é oferecido <strong>"como está"</strong>, sem garantia de disponibilidade contínua, principalmente durante o beta. Fazemos o possível pra manter seus dados seguros e íntegros (ver <Link to="/privacidade">Política de Privacidade</Link>), mas não nos responsabilizamos por decisão financeira tomada com base nos dados do app, nem por perda decorrente de uso indevido da sua própria conta.</p>
      </Secao>
      <Secao titulo="Cancelamento">
        <p className={styles.p}>Você pode parar de usar o Pontes e pedir a exclusão da sua conta e dos seus dados a qualquer momento, sem custo. É só falar com a gente (contato abaixo).</p>
      </Secao>
      <Secao titulo="Mudanças nestes termos">
        <p className={styles.p}>Podemos atualizar este documento conforme o produto evolui, principalmente ao sair do beta. Mudança relevante será avisada por e-mail ou dentro do app.</p>
      </Secao>
      <Secao titulo="Lei aplicável">
        <p className={styles.p}>Estes termos seguem a legislação brasileira, incluindo o Código de Defesa do Consumidor (Lei 8.078/1990) e o Marco Civil da Internet (Lei 12.965/2014).</p>
      </Secao>
      <Secao titulo="Fale com a gente">
        <div className={styles.contato}>Dúvida sobre estes termos, ou pedido de cancelamento: fale com quem te convidou pro beta.</div>
      </Secao>
    </PaginaLegal>
  )
}

export function Privacidade() {
  return (
    <PaginaLegal titulo="Política de Privacidade" atualizado="18 de agosto de 2026"
      beta="Você foi convidado pessoalmente pra testar o produto. Dados podem ser resetados ou perdidos durante essa fase. Por enquanto, evite depender do app como único registro do seu histórico financeiro.">
      <Secao titulo="O que coletamos">
        <p className={styles.p}>Pra funcionar, o Pontes guarda os dados que você mesmo digita: nome, e-mail, foto de perfil (se você puser uma; só quem está nas suas famílias vê), transações (valor, data, descrição, categoria), contas e cartões que você cadastra (só um nome e uma cor; não conectamos a nenhum banco de verdade) e, na função de empréstimos, o nome e valor de pessoas com quem você tem uma dívida ou crédito, mesmo que essa pessoa não tenha conta no Pontes.</p>
        <p className={styles.p}>O Pontes <strong>não</strong> se conecta à sua conta bancária real, não movimenta dinheiro, não processa pagamento e não tem custódia de nenhum valor seu. É um registro manual, mais parecido com uma planilha do que com um banco digital.</p>
      </Secao>
      <Secao titulo="Por que coletamos (base legal)">
        <ul className={styles.lista}>
          <li><strong>Seus próprios dados</strong> (conta, transações, cartões): tratados pra executar o contrato de uso do app, ou seja, o que você espera que o Pontes faça por você (Art. 7º, V da LGPD).</li>
          <li><strong>Dados de terceiros em empréstimos</strong> (nome/valor de alguém que te deve ou você deve): tratados com base em legítimo interesse: seu interesse legítimo em manter um registro pessoal de dívida (Art. 7º, IX). Coletamos só o mínimo (nome e valor), nunca dado extra dessa pessoa.</li>
        </ul>
      </Secao>
      <Secao titulo="Seus direitos">
        <p className={styles.p}>Você pode pedir acesso, correção, exclusão ou exportação dos seus dados a qualquer momento, inclusive dados de empréstimo sobre você registrados por outra pessoa, mesmo sem ter conta no Pontes. É só falar com a gente (contato abaixo); respondemos dentro do prazo legal.</p>
      </Secao>
      <Secao titulo="Com quem compartilhamos">
        <p className={styles.p}>Com ninguém, exceto: a outra pessoa de um empréstimo vinculado (ela vê o que você registrou sobre a dívida entre vocês dois) e provedores técnicos que hospedam o app (banco de dados, servidor e envio de e-mail). Eles não usam seus dados pra nada além de manter o Pontes no ar.</p>
      </Secao>
      <Secao titulo="Segurança">
        <p className={styles.p}>Senha protegida com Argon2id (padrão recomendado pela OWASP), conexão sempre criptografada (HTTPS), sessão em cookie seguro. Detalhe técnico completo em nossa documentação de segurança, disponível sob pedido.</p>
      </Secao>
      <Secao titulo="Fale com a gente">
        <div className={styles.contato}>Dúvida, pedido de acesso/exclusão de dados, ou qualquer coisa sobre privacidade: fale com quem te convidou pro beta.</div>
      </Secao>
    </PaginaLegal>
  )
}
