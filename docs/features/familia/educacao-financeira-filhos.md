---
feature: familia
sub-feature: educacao-financeira-filhos
status: MAPEAMENTO
owner: Gustavo
created: 2026-11-01
---

# Educação financeira dos filhos ("Banco da Família"): mapa

> Pedido do Gustavo (2026-11-01): uma seção onde os pais aprendem a dar educação financeira em casa, mais uma carta com
> um cartão que simula a vida real (abrir conta etc.). Os pais gerenciam, passa pelo app e mostra como o filho gasta.
> Inspiração: [@profe.serge](https://www.instagram.com/profe.serge/). Detalha a ideia do §16.6 de [`visao.md`](visao.md).

## 1. O que já existe

- **Dependente** (filho sem login, só para atribuir gasto): pronto no back ([`sub-3-dependentes`](sub-3-dependentes/arquitetura.md)).
- **[`visao.md`](visao.md) §16.6**: a ideia do "modo júnior" (carteira do filho, filho lança gastos, combinados,
  limites por idade, metas, painel dos pais), registrada como "depois do refator de Família".
- **O que este mapa acrescenta:** a seção de conteúdo para os pais, o kit físico (carta + cartão) e o "banco"
  operado pelos pais.

## 2. A inspiração: Banco Escolar (Profe Serge)

Sergio Aguilera, professor do ensino fundamental em Chihuahua, México (201 mil seguidores). O projeto dele é o
[Banco Escolar](https://bancoescolar.com): um banco simulado da sala de aula, **sem dinheiro real**.

- 7 operações com regras configuráveis: depósito, saque, transferência, câmbio, investimento, incentivo, empréstimo.
- Níveis Básico, Prata e Ouro, com juros e prazos.
- **Cartão físico por aluno com QR**: o aluno e a família veem saldo, investimentos e empréstimos, sem poder mexer.
- Extrato mensal em PDF; estorno com motivo e histórico; QR renovável e revogável se o cartão se perder.
- Diz que serve "também para famílias que educam em casa".

**O que aproveitar:** os pais são o banco; cartão com QR só de leitura; extrato do mês; juros para ensinar a poupar;
empréstimo para ensinar compromisso; níveis que sobem. O conteúdo e a marca são dele: usamos só como referência, ou
propomos parceria (ele tem e-mail para collabs; o conteúdo dele é em espanhol).

## 3. O mercado em 2026: por que não começar pelo cartão de verdade

- Conta e cartão reais para criança, **de graça** e com controle dos pais, já existem: Nubank (6 a 17 anos, desde
  janeiro de 2026), Santander, PicPay, C6 Yellow, Wise Cartão Mesada (junho de 2026), Google Wallet (agosto de 2026).
- Emitir cartão próprio nos coloca no regulado do BACEN (só via parceiro BaaS), com KYC, custo por cartão, fraude e
  contestação. Hoje o app fica fora do BACEN ([`CONFORMIDADE_BR.md`](../../CONFORMIDADE_BR.md)), e isso mudaria.
- **Nosso diferencial não é o cartão:** é o método (o que fazer em casa, semana a semana) mais o painel da família
  dentro do app que os pais já usam.

## 4. A proposta em 3 fases

### Fase 1: Banco da Família (simulado, sem dinheiro real), o MVP

1. **Seção "Educação financeira em casa"** para os pais: trilhas por idade (3 a 5, 6 a 9, 10 a 13, 14 a 17), uma
   atividade por semana (mesada em 3 potes: gastar, guardar, doar; "salário" por tarefa; juros pagos pelos pais;
   meta de compra), roteiro de conversa e checklist. Conteúdo nosso.
2. **Conta do filho** (evolução do Dependente): saldo simulado e operações (mesada, gasto, transferência, poupança com
   juros, empréstimo dos pais em parcelas, incentivo por tarefa). **Não soma com o dinheiro dos pais**: os saldos e
   relatórios dos pais continuam só com o dinheiro real.
3. **Os pais operam e o filho consulta.** No começo, o filho só lê pelo QR do cartão: sem login, sem e-mail da criança,
   o mínimo de dados. Depois, login júnior opcional (12+?) com autonomia por idade (§16.6).
4. **"Como meu filho gastou"** no painel dos pais (categorias simples, metas) e extrato mensal em PDF.
5. **Kit de abertura de conta** (a carta com o cartão): carta de boas-vindas com o nome do filho, "contrato" lúdico
   com as regras da casa e cartão com nome, nível e QR. **Sem cara de cartão de pagamento** (sem bandeira, sem número
   de 16 dígitos, com "cartão educativo, sem valor"). Primeiro em PDF para imprimir em casa (custo zero); depois kit
   físico pelos Correios (gráfica sob demanda; custo e preço a medir).

### Fase 2: ligar o dinheiro de verdade (sem virar banco)

- Mostrar os gastos da conta real do filho (Nubank, PicPay etc.) pelo importador de extrato que já temos (OFX/CSV) ou
  por Open Finance, se ele aceitar conta de menor (a confirmar).
- Mesada combinada: o app lembra, o Pix é feito no banco dos pais.

### Fase 3: cartão próprio Pontes (só se houver tração)

- Pré-pago via parceiro BaaS. Exige jurídico, KYC, BACEN via parceiro e custo por cartão. Só se os usuários pedirem.

## 5. Regras e cuidados (antes de produção)

- **LGPD art. 14:** dado de criança só com consentimento específico, em destaque, de pelo menos um dos pais, e no
  melhor interesse dela. Coletar o mínimo: apelido e ano de nascimento; sem CPF, sem e-mail da criança e sem foto
  obrigatória na Fase 1.
- **ECA Digital (Lei 15.211/2025)**, em vigor desde 17/03/2026, regulamentado pelo Decreto 12.880/2026 e fiscalizado
  pela ANPD. Para produto que criança provavelmente acessa, exige: supervisão parental acessível e em português,
  privacidade por padrão, aferição de idade confiável (autodeclaração não basta onde a lei exige) e nada de perfil
  para publicidade. O desenho "pais operam, filho só lê pelo QR" reduz muito essa exposição. **Advogado antes do
  login júnior.**
- **O QR é uma credencial:** token aleatório, só de leitura, renovável e revogável; nenhum dado pessoal dentro dele.
- **Linguagem:** sem dívida nem cobrança (regra do app); o empréstimo é um "combinado".
- **Kit físico:** o endereço dos pais é dado pessoal, usado só para o envio; o cartão não pode parecer meio de
  pagamento.

## 6. Encaixe no app

- **Reaproveita:** Família e papéis, Dependente (vira "conta do filho"), Metas (caixinhas), Empréstimos (parcelas),
  aprovação de despesa, notificações, PDF de relatório, DemoSeeder.
- **Novo:** movimentação simulada separada do dinheiro real, QR de consulta (página pública só de leitura com token),
  conteúdo educativo (markdown no próprio app), gerador do kit em PDF.
- **Produto:** benefício do plano família (ajuda no anti-churn: a família toda no app, e a criança que aprende vira
  usuária adulta).
- **Tamanho estimado (grosseiro):** Fase 1 sem login júnior = M/L. O conteúdo é trabalho editorial contínuo.
- **Quando:** depois do beta e do front de papéis da família (ROADMAP › Lote 2).

## 7. Decisões do Gustavo

Perguntar uma de cada vez, quando o item chegar na fila.

1. Começar pela Fase 1 simulada (recomendado) ou já correr atrás de cartão real?
2. Kit: PDF para imprimir primeiro e físico depois (recomendado)?
3. Filho só pelo QR no começo (recomendado) ou já com login?
4. Faixa de idade do MVP (sugestão: 6 a 13).
5. Procurar o Profe Serge para parceria ou conteúdo?
6. Grátis no plano família ou pago à parte?

## Fontes (consultadas em 2026-11-01)

- [Perfil @profe.serge](https://www.instagram.com/profe.serge/) · [linktr.ee/profe.serge](https://linktr.ee/profe.serge) · [bancoescolar.com](https://bancoescolar.com)
- Mercado: [Let's Money: Google Wallet, mesada digital](https://www.letsmoney.com.br/noticias/google-wallet-mesada-digital-filhos/) · [Mobile Time: Wise Cartão Mesada](https://www.mobiletime.com.br/noticias/22/06/2026/wise-cartao-mesada-inter/) · [Olhar Digital: Carteira do Google](https://olhardigital.com.br/2026/08/06/reviews/carteira-do-google-agora-voce-pode-controlar-os-gastos-dos-seus-filhos/) · [C6 Yellow: mesada](https://www.c6bank.com.br/blog/como-dar-mesada-para-seu-filho-com-o-cartao-c6-yellow)
- ECA Digital: [Demarest: entrada em vigor em 17/03/2026](https://www.demarest.com.br/eca-digital-entrada-em-vigor-em-17-de-marco-de-2026/) · [Mayer Brown: novas obrigações](https://www.mayerbrown.com/pt/insights/publications/2026/04/enforcement-of-brazils-eca-digital-introduces-new-obligations-for-companies) · [Canaltech: pontos para entender](https://canaltech.com.br/internet/pontos-para-entender-o-eca-digital-que-entra-em-vigor-nesta-terca-17/)
