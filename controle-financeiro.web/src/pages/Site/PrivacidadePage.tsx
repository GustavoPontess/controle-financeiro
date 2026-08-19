/**
 * PrivacidadePage — Política de Privacidade. Rota pública `/privacidade`.
 *
 * Conteúdo fundamentado na pesquisa de conformidade LGPD/BACEN de 2026-08-18
 * (docs/CONFORMIDADE_BR.md). Substitui a chamada solta que a footer do cadastro
 * já fazia — agora com página de verdade e checkbox de aceite real.
 */
import styles from "./PrivacidadePage.module.css"

export default function PrivacidadePage() {
  return (
    <div className={styles.root}>
      <div className={styles.wrap}>
        <div className={styles.eyebrow}>Legal</div>
        <h1 className={styles.title}>Política de Privacidade</h1>
        <p className={styles.updated}>Última atualização: 18 de agosto de 2026</p>

        <div className={styles.betaBox}>
          <strong>O Pontes está em beta fechado.</strong> Você foi convidado pessoalmente pra
          testar o produto. Dados podem ser resetados ou perdidos durante essa fase — evite depender
          do app como único registro do seu histórico financeiro por enquanto.
        </div>

        <div className={styles.section}>
          <h2 className={styles.h2}>O que coletamos</h2>
          <p className={styles.p}>
            Pra funcionar, o Pontes guarda os dados que você mesmo digita: nome, e-mail, transações
            (valor, data, descrição, categoria), contas e cartões que você cadastra (só um nome e
            uma cor — não conectamos a nenhum banco de verdade), e — na função de empréstimos —
            o nome e valor de pessoas com quem você tem uma dívida ou crédito, mesmo que essa pessoa
            não tenha conta no Pontes.
          </p>
          <p className={styles.p}>
            O Pontes <strong>não</strong> se conecta à sua conta bancária real, não movimenta
            dinheiro, não processa pagamento e não tem custódia de nenhum valor seu — é um
            registro manual, mais parecido com uma planilha do que com um banco digital.
          </p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.h2}>Por que coletamos (base legal)</h2>
          <ul className={styles.list}>
            <li><strong>Seus próprios dados</strong> (conta, transações, cartões): tratados pra
              executar o contrato de uso do app — o que você espera que o Pontes faça por você
              (Art. 7º, V da LGPD).</li>
            <li><strong>Dados de terceiros em empréstimos</strong> (nome/valor de alguém que te deve
              ou você deve): tratados com base em legítimo interesse — seu interesse legítimo em
              manter um registro pessoal de dívida (Art. 7º, IX). Coletamos só o mínimo (nome e
              valor), nunca dado extra dessa pessoa.</li>
          </ul>
        </div>

        <div className={styles.section}>
          <h2 className={styles.h2}>Seus direitos</h2>
          <p className={styles.p}>
            Você pode pedir acesso, correção, exclusão ou exportação dos seus dados a qualquer
            momento — inclusive dados de empréstimo sobre você registrados por outra pessoa, mesmo
            sem ter conta no Pontes. É só mandar um e-mail (contato abaixo); respondemos dentro do
            prazo legal.
          </p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.h2}>Com quem compartilhamos</h2>
          <p className={styles.p}>
            Com ninguém, exceto: a outra pessoa de um empréstimo vinculado (ela vê o que você
            registrou sobre a dívida entre vocês dois) e provedores técnicos que hospedam o app
            (banco de dados e servidor) — eles não usam seus dados pra nada além de manter o Pontes
            no ar.
          </p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.h2}>Segurança</h2>
          <p className={styles.p}>
            Senha protegida com Argon2id (padrão recomendado pela OWASP), conexão sempre criptografada
            (HTTPS), sessão em cookie seguro. Detalhe técnico completo em nossa documentação de
            segurança, disponível sob pedido.
          </p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.h2}>Fale com a gente</h2>
          <div className={styles.contactBox}>
            Dúvida, pedido de acesso/exclusão de dados, ou qualquer coisa sobre privacidade:{" "}
            <a href="mailto:gut.n.pontes@gmail.com">gut.n.pontes@gmail.com</a>
          </div>
        </div>
      </div>
    </div>
  )
}
