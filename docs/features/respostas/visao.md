# Respostas, não só registro (visão, 2026-10-19)

> Ideia do Gustavo, estruturada na conversa de 2026-10-19. **Passo 1 feito (2026-10-19, branch `feat/v2-respostas`):** a conta do mês no servidor (`DinheiroDoMesService`), o cartão "Renda do mês" no Início (`UsoDaRenda`), as respostas em Limites ("vai passar", o que ainda vem) e o "essa meta cabe?" no formulário de meta (`ViabilidadeMetaService`).

## O problema

O app hoje registra pra onde o dinheiro foi. É o que os concorrentes fazem. A pessoa preenche tudo e não recebe a resposta que procura:

- "Vai dar pra pagar tudo este mês?"
- "Essa viagem de R$ 5 mil em dezembro cabe?" (no ritmo de hoje ela junta R$ 3 mil)
- "Estou comprometendo minha renda inteira?"
- "Onde dá pra cortar?" (ex.: fast food alto)
- "Quero juntar rápido, tipo aposentar cedo: qual o plano?"

O Monarch tinha uma página de conselhos estáticos (cards com tarefas) e matou em 28/09/2026 pra pôr um assistente de IA, que só responde quando a pessoa pergunta (ver `docs/concorrentes/monarch/paginas/advice.md` e `ai-assistant.md`). Ninguém avisa na hora da decisão (criar a meta, passar do limite), e nenhum app BR faz isso.

## A base: o mês da pessoa (regra única, no servidor)

Quase toda resposta sai do mesmo cálculo. Ele mora num lugar só, como `RegrasFinanceiras`, e as telas nunca fazem conta solta:

| Peça | De onde vem (já existe) |
|---|---|
| Renda esperada | Renda (`RendaPrevista`: fixa + variável declaradas) |
| Renda que ainda vai cair no mês | receitas previstas do mês |
| Contas fixas que ainda vão cair | `Recorrente` → previsões do mês |
| Faturas a pagar | `RegrasFinanceiras` (restante de fatura) |
| Parcelas já compradas (próximos meses) | `RegrasFinanceiras.ParcelasPorMesAsync` (parcela no mês dela, com juros) |
| Gasto típico por categoria | `GastosPorCategoriaDoMesAsync`, média dos últimos 3 meses |
| O que as metas pedem | `MetaService` (por mês de cada meta) |
| Saldo de hoje | `SaldosDasContasAsync` |

Daí saem três números que respondem a maioria das perguntas:

- **Fim do mês:** saldo de hoje + renda que ainda cai − contas e faturas que ainda vencem − gasto típico do que falta do mês. Positivo = dá; negativo = falta R$ x.
- **Folga por mês:** renda esperada − contas fixas − gasto típico. É o que dá pra guardar ou gastar a mais sem apertar.
- **Comprometimento da renda:** contas fixas + gasto típico ÷ renda esperada.

Fato e previsto ficam separados nos números, mas juntos na resposta.

## A cara da resposta: "Renda do mês" (ideia do Gustavo, 2026-10-19)

Inspirada no medidor de contexto do Claude Code: o total da barra é a renda do mês e, embaixo, o que está comendo ela.

- Topo: "Renda de outubro" e quanto recebeu; "169% usado · R$ 6.603,93 / R$ 3.903,23".
- Barra empilhada: cada categoria um pedaço; o que **ainda vem** (conta fixa prevista, fatura) listrado, como o "deferred" do medidor; o que sobra vazio ("Livre"). Passou da renda: a barra cresce além da marca "sua renda".
- Legenda em dois grupos: **Já saiu** e **Ainda vem este mês** (nome, dia, valor, % da renda); última linha "Livre" ou "Passou da renda".
- Embaixo, a resposta em uma frase e a ação: "Saiu mais do que entrou: R$ 2.700,70 acima da renda. O maior peso é Sem categoria (R$ 4.312,13)" → Classificar lançamentos · Ver onde cortar.
- Mora no Início (é a resposta principal do mês), na Renda e no check-up de Relatórios. Vem do mesmo cálculo do mês.
- Metas entram como um pedaço ("Guardado nas metas") quando a pessoa guarda no mês.
- **Fatura e parcelas (decisões do Gustavo, 2026-10-19):** a compra no cartão conta como gasto no mês em que foi feita; parcela, no mês dela (nunca o total no mês da compra). A fatura a pagar aparece à parte ("Faturas a pagar este mês", o lado do caixa), fora do gasto e do livre. O que já está comprado pros próximos meses também aparece à parte ("Parcelas já compradas pros próximos meses": 3 meses e "depois, até …"), na ficha do limite da categoria e no "essa meta cabe?" (a folga desconta a média das parcelas no prazo; o gasto normal é sem parcelas, pra não contar duas vezes).

Números do mockup = a conta do Gustavo em outubro/2026 (banco local).

## As camadas

1. **Resposta na hora, em cada tela.** Uma linha com o número e a ação, no momento da decisão. Regras fixas (sem IA), testáveis.
   - Criar meta: "No ritmo de hoje você junta uns R$ 3.000 até dezembro. Faltam R$ 2.000: guardar R$ 700 por mês ou mudar o prazo pra março." Avisa, não proíbe.
   - Meta impossível: "Pra juntar R$ 1 milhão em 12 meses precisa guardar R$ 83.334 por mês. Você recebe R$ 1.000."
   - Lista de metas: "As metas pedem R$ 5.206 por mês; a sua folga é uns R$ x. Pra caber: esticar o prazo do Carro."
   - Limite passou ou vai passar: "Ainda vem a Internet (dia 20, R$ 99,90): com ela você passa do limite. Dá pra cortar: Streaming R$ 39,90." Cada conta que vem aparece com link pra pausar ou cancelar.
   - Início: "Vai dar até o fim do mês" ou "Falta R$ x até dia 30".
2. **Sinais (o app avisa sozinho).** Mesmo padrão do `AlertaLimitesJob`: uma vez por assunto e mês, notificação + cartão no Início.
   - "Suas contas fixas e gastos levam 92% da sua renda."
   - "Fast food: R$ 600 este mês, o dobro do seu normal."
   - "A meta da viagem saiu do ritmo."
3. **Relatórios = o check-up completo.** A página que junta tudo: pra onde foi, folga, comprometimento, reserva de emergência (em meses de gasto), não essenciais, tendências. Continua sendo a última tela do v2, agora com motivo: ela é a soma das respostas das outras.
4. **Modo "juntar mais" (plano).** A pessoa escolhe o ritmo (normal, apertado, agressivo, como o pessoal que quer se aposentar cedo) e o app monta o plano: quanto guardar por mês, quanto cortar por categoria não essencial, e acompanha mês a mês.
5. **Conversa.** O app pergunta o que falta pra responder melhor, aos poucos, conforme os dados entram: "Quanto você espera receber por mês?" quando não tem renda declarada, ou "Isso é essencial?" quando aparece gasto numa categoria nova. Primeiro como cartões de pergunta (sem IA). Depois, um assistente de IA (tool-use sobre o mesmo cálculo, com consentimento LGPD e aviso de que não é recomendação financeira), como o Monarch fez, mas que também entende casal.

## Dado que falta

- **Essencial ou não** por categoria/subcategoria (mercado é essencial, fast food não). As categorias padrão já nascem marcadas; a pessoa muda. Base dos cortes sugeridos e do modo "juntar mais".
- **Assinaturas** como tipo de conta fixa (pra sugerir cancelar).
- Renda declarada é opcional hoje: sem ela, as respostas usam a renda média que caiu nos últimos 3 meses e a tela pede pra declarar.

## Ordem

1. ✅ O cálculo do mês (regra única) + o cartão no Início + resposta em Limites e ao criar meta.
2. Lista de Metas (as metas juntas cabem na folga?) e o cartão também na tela de Renda.
3. **Tela de Empréstimos** (o Gustavo lembrou: falta antes de Relatórios).
4. Essencial/não essencial + sinais.
5. Relatórios (check-up).
6. Modo "juntar mais".
7. Conversa (cartões, depois IA).
