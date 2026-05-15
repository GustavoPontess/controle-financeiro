---
feature: familia
status: VISAO (não implementado)
owner: Gustavo
created: 2026-05-15
last_reviewed: 2026-05-15
next_review: 2026-08-15
---

# Feature: Família — Visão de Produto

> Documento de visão. **Não é spec técnica fechada** — é o "para onde vamos" que serve de norte para conversas, decisões e specs detalhadas por sub-feature. Specs técnicas (entidades, contratos de API, fluxos) entrarão em arquivos próprios nesta mesma pasta conforme cada sub-feature for implementada.

---

## 1. O problema que estamos resolvendo

Os apps de controle financeiro brasileiros (Mobills, Organizze, GuiaBolso, Wallet) são **individuais por design**. Quando duas ou mais pessoas convivem e dividem dinheiro — casal, família, república, sócios de pequeno negócio — esses apps falham em três pontos:

1. **Cada um lança suas próprias despesas em silos separados.** Não há visão consolidada do que entra e sai do "caixa do casal".
2. **Não existe noção de "quem paga o quê".** O Mercado de R$ 300 que o marido pagou some no histórico individual dele; a esposa não vê, e quando dá briga ninguém lembra quem pagou o quê.
3. **Dependentes (filhos, pais idosos) não têm representação financeira.** Você quer saber quanto gastou com cada filho neste ano? Boa sorte filtrando manualmente categorias.

Os fóruns de finanças domésticas (`r/financas`, grupos de Facebook, Twitter) estão cheios de pedido por "um app pra casal" — a demanda existe e está mal atendida.

---

## 2. Princípio de design fundamental

**A unidade de propriedade financeira é a pessoa, não a família.**

Cada usuário tem seu controle financeiro **pessoal e privado por padrão**. Despesas pessoais (terapia, presente surpresa pro parceiro, hobby caro que o outro não aprovaria) ficam dentro da esfera individual e **não vazam** para a família.

A família é uma **camada de compartilhamento opcional sobre o individual** — quando o usuário escolhe lançar uma despesa como "compartilhada", ela passa a ter visibilidade na família e entra nas regras de rateio.

Esse princípio resolve a maior objeção que mata adoção em apps de casal: medo de perder privacidade financeira individual.

---

## 3. Hierarquia conceitual

```
Pessoa (Usuário)
│
├── Finanças Pessoais (sempre privadas)
│   ├── Contas próprias
│   ├── Cartões próprios
│   ├── Transações pessoais
│   ├── Orçamentos pessoais
│   └── Metas pessoais
│
└── Família (1..N — pessoa pode pertencer a várias)
    ├── Membros (com Papel editável)
    │   ├── Outros usuários (com conta ativa)
    │   ├── Membros convidados pendentes (link de convite)
    │   └── Dependentes (sem login — representação financeira)
    │
    ├── Despesas Compartilhadas
    │   └── Cada despesa marca: quem pagou + quem se beneficiou
    │
    ├── Regra de Rateio
    │   ├── Igualitário (divide igual entre adultos)
    │   ├── Proporcional à renda (cada um informa renda, divide pelo peso)
    │   └── Customizado por despesa (regra ad-hoc)
    │
    └── Balanço Familiar
        └── "Quem deve a quem" — saldo de quanto cada membro pagou vs deveria ter pago
```

### 3.1 Por que "Família" e não "Grupo"?

Outros apps internacionais (Splitwise, Tricount) usam "grupo" — funciona pra viagem com amigos mas não cria identidade. **Família** carrega significado emocional e estabilidade temporal: você não cria uma "família" pra dividir conta de pizza, cria pra organizar uma vida em comum.

Para casos mais leves (república, viagem, projeto), podemos no futuro ter uma variação "Grupo" com semântica mais transacional. **Não no MVP.**

---

## 4. Papéis (Roles)

Papéis são **rótulos editáveis** que descrevem a relação do membro com a família. Eles informam UX e podem (no futuro) informar permissões.

### 4.1 Papéis sugeridos (preset)

| Papel | Descrição | Permissões padrão |
|---|---|---|
| Administrador | Quem criou a família | Tudo, incluindo remover membros e dissolver família |
| Esposo / Esposa | Cônjuge | Lançar, ver tudo, propor mudança de regra |
| Companheiro / Companheira | União estável | Igual a cônjuge |
| Namorado / Namorada | Relacionamento sem coabitação formal | Lançar e ver. Sem editar regras |
| Pai / Mãe | Genitor | Igual a cônjuge |
| Filho / Filha (adulto) | Filho maior de idade com conta própria | Lançar e ver. Sem editar regras |
| Irmão / Irmã | Vínculo familiar | Configurável |
| Sócio | Parceiro financeiro de negócio | Configurável |
| Amigo | Coabitação informal (república) | Configurável |
| Personalizado | Texto livre | Configurável manualmente |

### 4.2 Papel é editável

Esse é um requisito de UX importante: **a namorada vira esposa**, o filho vira "filho adulto independente", o sócio vira ex-sócio. Mudar o papel não deve perder histórico — só atualiza o rótulo e (se a regra estiver vinculada ao papel) reativa permissões.

Quem pode editar?
- O próprio membro pode editar **o próprio papel** (auto-declaração).
- O administrador pode editar **qualquer papel**.
- Mudança de papel gera notificação para os demais membros.

### 4.3 Permissões — princípio "compartilhado é compartilhado"

**MVP de permissões mantém simples:**

- Todos os membros adultos veem todas as despesas compartilhadas.
- Todos os membros adultos podem lançar despesa compartilhada.
- Só administradores podem: convidar, remover, editar regra de rateio, dissolver família.

Permissões granulares (ex: membro só vê o que lança) ficam para versão futura — adicionam complexidade sem demanda comprovada no MVP.

---

## 5. Convites

### 5.1 Dois caminhos

**Convite para alguém que já tem conta:**
- Admin insere e-mail ou número do convidado.
- Sistema identifica conta existente.
- Convidado recebe notificação in-app + e-mail.
- Convidado vê preview: "Gustavo te convidou para a família 'Família Pontes' como Esposa".
- Aceita ou recusa.

**Convite para alguém que não tem conta:**
- Admin insere e-mail ou número.
- Sistema gera link único com token (expira em 7 dias).
- Convidado recebe link via WhatsApp/SMS/e-mail (interface do admin facilita o compartilhamento).
- Ao clicar, abre fluxo de cadastro pré-vinculado à família + papel.
- Após cadastro completo, entra automaticamente na família.

### 5.2 Regras importantes

- **Convite é sempre revogável** pelo admin enquanto não aceito.
- Convite expirado pode ser reenviado (gera token novo).
- Pessoa pode rejeitar convite — admin é notificado.
- Pessoa não pode ser convidada duas vezes para a mesma família simultaneamente.
- **Convite consome slot da família** (anti-spam) — limite por família de N convites pendentes simultâneos.

---

## 6. Dependentes

### 6.1 O que é

Dependente é uma **entidade financeira sem login**, criada pela família para registrar gastos atribuídos a uma pessoa que não usa o app — filho pequeno, idoso sob cuidado, animal de estimação.

Não confundir com membro: membro é alguém com conta que pode lançar e ver. Dependente é apenas um **rótulo de atribuição** para despesas.

### 6.2 Dados de dependente

- Nome (obrigatório)
- Apelido (opcional)
- Data de nascimento (opcional — usada para idade)
- Tipo: criança, idoso, pet, outro
- Foto/avatar (opcional)
- Ativo desde / inativo desde (histórico preservado)

### 6.3 Casos de uso

- "Quanto gastei com o João (5 anos) este ano?" — filtro por dependente.
- "Plano de saúde da minha mãe (76 anos) entra em qual categoria?" — categoria + dependente.
- "Curso de inglês da Maria" — despesa atribuída à dependente.

### 6.4 Quando dependente vira membro?

Quando o filho cresce e abre a primeira conta, o admin **promove** o dependente a membro convidado — o histórico do dependente é vinculado ao novo perfil do membro. Esse fluxo é importante porque preserva continuidade ("eu sempre vi quanto gasto com meu filho, mesmo depois que ele virou adulto").

---

## 7. Sistema de Rateio (o coração do diferencial)

### 7.1 Cada despesa compartilhada responde a 3 perguntas

1. **Quem pagou?** — uma ou mais pessoas, com proporção. Default: quem lançou.
2. **Para quem foi a despesa?** — uma ou mais pessoas/dependentes, com proporção. Default: todos os membros adultos igualmente.
3. **Como divide?** — regra de divisão (igualitário, proporcional à renda, custom).

### 7.2 Regras de divisão pré-configuradas

**Modo Igualitário (padrão para MVP):**
- Divide igual entre os membros adultos que se beneficiaram.
- Dependentes não pagam — beneficiam-se sem peso na divisão.
- Ideal para casais novos, repúblicas, finanças horizontais.

**Modo Proporcional à Renda:**
- Cada membro adulto declara sua renda mensal (privada — só o próprio vê o valor, os outros veem só o peso resultante).
- Despesas dividem pelo peso de renda.
- Ideal para casais com disparidade salarial significativa onde o casal acordou que "divide na proporção do que cada um ganha".

**Modo Custom por despesa:**
- Cada lançamento define quem paga e quem se beneficia, sem regra padrão.
- Mais flexível, mais friction. Ideal para grupos ad-hoc.

### 7.3 Como o app calcula "quem deve a quem"

Para cada despesa: `(quanto cada um pagou)` − `(quanto cada um deveria ter pago segundo a regra)` = saldo da despesa para cada pessoa.

Soma tudo no período: cada membro tem um saldo geral. Saldo positivo = a família deve para esse membro. Saldo negativo = esse membro deve para a família.

A tela mostra: "Você pagou R$ 1.500 este mês em despesas familiares. Seu peso é 60% (R$ 1.800 esperado). Falta lançar R$ 300 ou receber R$ 300 do parceiro."

### 7.4 Acerto de contas

Quando alguém quer **fechar o saldo**:
- Tela "Acertar contas" mostra: "Você deve R$ 300 para Gustavo".
- Botão "Marcar como pago" registra uma transferência interna no app (não mexe nos saldos das contas reais — apenas zera o saldo dentro da família).
- Notificação para a outra parte: "Maria marcou como pago R$ 300 que devia a você."
- Pode adicionar comprovante (foto do PIX, por exemplo).

### 7.5 "Transparência sem brigas" (princípio de UX)

Linguagem do app evita gatilhos emocionais. Não diz "você está em dívida" — diz "saldo pendente". Não diz "atrasado" — diz "ainda não acertado". Pequenas escolhas de copy fazem diferença gigante em produto de casal.

---

## 8. Privacidade — o que **não** é compartilhado

Lista explícita do que **permanece privado por padrão**, mesmo dentro de uma família:

- Salário/renda total (o sistema sabe o peso, não o valor — só o próprio vê)
- Contas bancárias pessoais (a família vê só as despesas marcadas como compartilhadas, não o saldo da conta)
- Cartões pessoais (idem)
- Investimentos pessoais
- Histórico de transações pessoais (só as compartilhadas vazam)
- Mensagens de comprovante (visíveis apenas para envolvidos na despesa específica)

**Default seguro:** uma despesa é pessoal a não ser que o usuário **explicitamente** marque como "compartilhar com a família". Nada vaza por acidente.

---

## 9. Múltiplas famílias

Uma pessoa pode pertencer a várias famílias simultaneamente. Casos:

- Pessoa A é casada (família principal) **e** divide aluguel com amigos (família "Apartamento Vila Madalena") **e** participa do controle financeiro com os pais (família "Mães e Filhos").
- Cada família tem regras, membros e balanços independentes.
- A pessoa vê um seletor de família no topo da tela quando está em contexto compartilhado.

**Importante:** despesa lançada em uma família **não vaza** para outra. Isolamento total entre famílias da mesma pessoa.

---

## 10. Casos extremos que precisam de decisão futura

Listo aqui para não esquecer — não resolver agora, só registrar:

- **Divórcio / saída de membro.** Histórico vira read-only para quem sai? Saldos pendentes congelam? Como protege a parte que sai?
- **Falecimento de membro.** Quem pode "fechar" a participação? Histórico vai para herdeiros?
- **Briga sobre uma despesa.** Membro contesta despesa lançada por outro. Sistema de "contestar despesa" precisa existir?
- **Mudança de regra de rateio com despesas anteriores.** Recalcula passado ou só vale daqui pra frente?
- **Crianças que viram adultas no meio do ano.** Quando deixam de ser "dependente sem peso" e passam a contar no rateio?
- **Casal LGBTQIA+ / arranjos não-binários.** Papéis são genéricos o bastante? "Cônjuge" é melhor que "esposo/esposa" como default?
- **Pensão alimentícia.** Caso específico — pai paga para criança que mora com a mãe. Cabe na feature ou é nicho à parte?

Todos esses são casos reais e merecem decisão deliberada. Vamos atacar conforme aparecerem em validação com usuários.

---

## 11. Roadmap de implementação (sugerido — discutir antes de detalhar)

A feature Família não é monolítica. Sugiro quebrar em sub-features que entregam valor incremental:

**Sub-feature 1 — Família e Membros (sem rateio).**
Criar família, convidar membros (ambos caminhos), aceitar convite, papéis editáveis, listar membros, sair de família. **Valor entregue:** consigo enxergar quem está na minha família no app.

**Sub-feature 2 — Despesa Compartilhada (modo igualitário).**
Marcar transação como compartilhada, ver feed de despesas compartilhadas, balanço mensal automático no modo igualitário. **Valor entregue:** primeira utilidade prática — ver "quem gastou quanto" no mês.

**Sub-feature 3 — Dependentes.**
Criar dependente, atribuir despesa a dependente, filtro "quanto gastei com X". **Valor entregue:** caso de uso "controle de gasto com filho" liberado.

**Sub-feature 4 — Modos de rateio (proporcional à renda + custom).**
Adicionar opções avançadas de divisão. **Valor entregue:** atende casal com renda desigual.

**Sub-feature 5 — Acerto de contas e transferências internas.**
Botão "marcar como pago", histórico de acertos, comprovantes. **Valor entregue:** fluxo de fechamento de saldos.

**Sub-feature 6 — Múltiplas famílias.**
Seletor de família, isolamento, papel diferente em cada uma. **Valor entregue:** atende casos avançados (família + república + pais).

Cada sub-feature merece seu próprio arquivo de spec (`arquitetura.md`, `ux.md`, `state.md`) dentro de `docs/features/familia/sub-X-<nome>/`.

---

## 12. Métricas de sucesso (como saber se a feature está funcionando)

Quando a feature estiver em produção, queremos rastrear:

- % de usuários que criam família após primeiros 30 dias
- Tamanho médio de família (membros + dependentes)
- Frequência de uso de "despesa compartilhada" vs "despesa pessoal" pelo mesmo usuário
- Retenção em D30 e D90 para usuários **em família** vs usuários **sozinhos** — se a feature funciona, retenção em família deve ser significativamente maior
- Distribuição entre os modos de rateio (qual o casal brasileiro adota mais?)
- Frequência de uso da função "acertar contas"

Métricas qualitativas:
- NPS específico para usuários em família (canal de feedback no app)
- Frequência de menções a "briga sobre dinheiro" em chats de suporte (esperamos diminuir)

---

## 13. Concorrentes a estudar

Antes de detalhar specs técnicas, vale uma volta pelos competidores diretos e indiretos:

- **Splitwise** (gringo, casual): rateio entre amigos. Não tem categoria financeira nem histórico longo. UX referência para "quem deve a quem".
- **Tricount** (europeu, viagem): rateio de viagem. Bom no instante, fraco no longo prazo.
- **Honeydue** (US, casal): foi adquirido — referência de UX para casal. Estudo de caso obrigatório.
- **Zeta** (US, casal moderno): app financeiro para casal com conta compartilhada real. Marketing referência.
- **Mobills modo "compartilhado"** (BR): feature mais simples, agregação básica de contas — ver onde falha.
- **Organizze "vida em comum"** (BR, se existir): conferir antes de fechar UX.

Cada um desses tem decisões boas e ruins. Não vamos copiar nenhum — vamos pegar o melhor de cada e adaptar ao brasileiro.

---

## 14. O que **NÃO** está nesta feature

Para evitar feature creep:

- Conta bancária verdadeiramente conjunta (com integração com banco). Isso é outra feature, depende de Open Finance.
- Cartão de crédito adicional (cônjuge tem cartão adicional). É registro manual no MVP.
- Investimentos compartilhados.
- Empréstimo entre membros da família como produto financeiro. Já temos entidade `Emprestimo` no domínio individual.
- Compras programadas em grupo (lista de mercado colaborativa). Outra feature.
- Mesada digital para filhos. Outra feature, depois.

---

## 15. Próximo passo

Antes de detalhar entidades, contratos e telas, **validar essa visão**:

1. Discutir cada princípio com o usuário-piloto (você + parceira/o, se aplicável).
2. Procurar 5-10 casais conhecidos e mostrar essa visão pra ouvir reações.
3. Iterar antes de codar.

Spec técnica de cada sub-feature começa **depois** que essa visão estiver consensuada.
