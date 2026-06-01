# Comparativo geral — Pierre × Despezzas × Pontes (nós)

> Síntese das análises (deep dive logado feito em 2026-05-31). Detalhe por concorrente em `pierre/` e `despezzas/`. Este doc é a leitura estratégica cruzada **com o nosso produto**.

## 1. Posicionamento em uma linha

| | Pierre | Despezzas | **Nós (Pontes)** |
|---|---|---|---|
| Pitch | "Assistente de IA que age por você" | "Automatize e economize sem esforço" | "Finanças de casais e famílias, do seu jeito" |
| Core | IA conversacional + agentes | Open Finance + IA, barato, mobile | **Família/casais** + personalização + desktop |
| Plataforma | web-first | **mobile-first** + web | web/desktop-first |
| Filosofia | **detect-and-correct** (revisa o que o banco traz) | **create-manual + Open Finance** (híbrido) | **create-manual** (CRUD completo) |
| Backing | **Cloudwalk** (forte) | INSIDE TECH (350K usuários) | — |

## 2. Preços (mensal · anual)

| Plano | Pierre | Despezzas | Nós |
|---|---|---|---|
| Grátis | 1 banco, 1 agente | sim (muita coisa PRO) | a definir |
| Entrada | **Pro R$ 39** (5 bancos, 2 agentes) | **Individual R$ 34,90 · R$ 169,90/ano** (4 bancos) | a definir |
| Topo | **Premium R$ 199** (bancos ilim., 10 agentes, API) | **Plus R$ 89,90 · R$ 289,90/ano** (ilim., 3 perfis) | a definir |

- **Despezzas ancora o mercado BR em R$ 35–90.** Pierre é premium-nicho (R$ 199).
- Os dois **monetizam integração (bancos) + IA/perfis**, nunca o CRUD básico.
- **Família é o caro:** no Despezzas, perfis compartilhados só no Plus (R$ 89,90/mês). Pierre nem tem.

## 3. Matriz de features

✅ tem · ⚠️ parcial/raso · ❌ não tem · 🔒 só pago

| Feature | Pierre | Despezzas | **Nós** |
|---|---|---|---|
| **Família/casais (rateio, papéis, aprovação)** | ❌ | ⚠️ 🔒 "separar perfis" (não é rateio real) | ✅ **nosso fosso** |
| Open Finance (sync bancário) | ✅ | ✅ 🔒 | ❌ |
| IA conversacional (chat) | ✅ | ✅ 🔒 | ❌ |
| Agentes autônomos IA | ✅ | ❌ | ❌ |
| Categorização automática IA | ✅ | ✅ 🔒 | ❌ |
| App mobile nativo | ✅ | ✅ (é o foco deles) | ❌ |
| CRUD manual completo (criar/editar/excluir) | ❌ (só ocultar) | ✅ | ✅ |
| Previsto × efetivado | ✅ | ✅ | ✅ (recém-feito) |
| Parcelamento + timeline | ✅ | ✅ | ✅ |
| Recorrentes | ✅ | ✅ | ✅ |
| Assinaturas (detecção/visão) | ✅ | ✅ | ⚠️ (temos `Recorrente`, falta visão) |
| Cartão/fatura | ✅ | ✅ 🔒 | ✅ |
| Filtros de transação ricos (conta/cartão/valor/status/categoria) | ✅ | ✅ | ⚠️ (só mês + chips + 1 categoria) |
| Categorias hierárquicas (cat+subcat, ícone+cor) | ✅ | ✅ (25+96) | ⚠️ (temos categorias; checar subcat) |
| Relatórios/gráficos | ✅ | ✅ 🔒 | ✅ (`/reports`) |
| Metas | ⚠️ | ✅ 🔒 | ⚠️ |
| Limites de gasto | ✅ (via agente) | ✅ 🔒 | ✅ |
| **Personalização (paletas/fontes)** | ❌ (dark fixo) | ❌ (3 temas) | ✅ **15 paletas + 7 fontes** |
| Ferramentas grátis (SEO) | ❌ | ✅ (6 calculadoras) | ❌ |
| Blog/conteúdo (SEO) | ❌ | ✅ (~400 artigos) | ❌ |
| Programa de indicação (referral) | ❌ | ✅ | ❌ |
| Auth sem fricção | ✅ (WhatsApp passwordless) | ⚠️ (email+senha) | ⚠️ (email+senha) |
| Canal WhatsApp | ✅ | ❌ | ❌ |
| Multi-moeda | ✅ | ✅ | ⚠️ |
| Orçamento (salário − meta) | ⚠️ | ✅ | ❌ |

## 4. Filosofia de produto — onde a gente se encaixa

- **Pierre = revisão.** Open Finance traz tudo, IA categoriza/analisa, usuário só ajusta (ocultar, "não é assinatura"). **Não dá pra editar/excluir nada** — ledger imutável. CRUD manual só pra dinheiro vivo.
- **Despezzas = híbrido.** Tem Open Finance (pago) **mas também CRUD manual completo** (criar/editar/duplicar/excluir, com confirmação). Muito mais perto de nós.
- **Nós = registro.** CRUD completo em qualquer conta, controle manual fino. **Igual ao lado "manual" do Despezzas, sem o Open Finance.**

**Implicação:** os DOIS concorrentes fortes são Open-Finance-first. Sem Open Finance, somos "o app que dá trabalho de digitar". É o **gap estratégico nº 1**. Enquanto não temos, o que segura é **família real + personalização + desktop caprichado**.

## 5. O que eles têm que a gente não tem (priorizado por impacto × custo)

### 🟢 Barato, alto valor — fazer já (front/dados que já temos)
1. **Filtros de transação ricos** — por conta, cartão, valor, status, multi-categoria. Os DOIS têm; nós temos só mês + chips. Gap puramente de front.
2. **Ferramentas grátis (SEO)** — 1-2 calculadoras (rendimento, CLT×PJ) no nosso site. Despezzas prova o funil. Copiável.
3. **Visão de assinaturas** — agrupar recorrências + "em qual cartão" + projeção anual. Já temos `Recorrente`, falta a tela.
4. **Orçamento simples** (salário − meta de economia = quanto pode gastar) — barato, alto valor percebido (Despezzas).
5. **Programa de indicação** — loop viral (amigo ganha X dias). Despezzas usa.
6. **Variação % vs mês anterior** nos cards — já no radar do `/reports`.

### 🟠 Médio — diferencial
7. **Aprofundar família REAL** (rateio "quem paga o quê", aprovação de despesa, papéis dinâmicos, dependentes). **É onde NENHUM dos dois chega** — Pierre é individual, Despezzas é "separar perfis" pago. Cavar fundo **antes** que o Despezzas evolua o "compartilhado".
8. **Conteúdo SEO mirando casal/família** — disputar "finanças do casal" no Google (Despezzas já mira).
9. **App mobile (ou PWA forte)** — Despezzas prova que o público BR é mobile. (Mas: nossa memória diz desktop-primeiro; mobile fica pro fim.)

### 🔴 Caro, estratégico
10. **Open Finance** — paridade real depende disso. Gap nº 1.
11. **IA conversacional / categorização** — core dos dois, percepção de valor alta.

## 6. O que defender (nosso fosso)

1. **Gestão de família de verdade** — rateio, papéis, aprovação, dependentes. Pierre não tem; Despezzas só "separa perfis" (e cobra caro). **Maior diferenciação.** _(Benchmark global de casal = **Monarch** (líder US); mas o modelo dele é **merge/visão compartilhada + atribuir-pra-revisar**, sem rateio/papéis/dependentes — ver `monarch/comparativo.md`. Valida o mercado, mas o modelo família BR continua espaço aberto.)_
2. **Contadores (segmento)** — temos página/segmento "Para Contadores" (`/contadores`). **Nenhum dos dois mira contador:** Despezzas é 100% finanças pessoais (o "PJ" do Plus é pro próprio usuário, não pra contador gerenciar clientes); Pierre é IA individual. **Território livre dos dois.** Gestão multi-cliente / escritório de contabilidade é espaço nosso.
3. **Personalização visual** — 15 paletas + 7 fontes. Nenhum dos dois tem (Pierre dark fixo, Despezzas 3 temas).
4. **CRUD manual fino + desktop** — pra quem quer controle real, não só "revisar o que o banco mandou".

## 7. Veredito estratégico

- **Despezzas é o concorrente mais perigoso** (não o Pierre): barato pro bolso BR, escala (350K), mira casal/MEI no marketing, CRUD igual ao nosso. Mas o "família" dele é raso e pago — **janela aberta pra gente**.
- **Não virar mais um clone Open-Finance-first** sem fosso: a gente perde no preço/escala pro Despezzas e na IA pro Pierre.
- **Jogada:** cavar **família real** (o que os dois não fazem) + fechar os gaps baratos de UX (filtros, assinaturas, orçamento, SEO) pra não parecer atrás. Open Finance e IA entram quando der — mas o fosso vem primeiro.

## 8. Diferenças de qualidade observadas (a nosso favor)

- Despezzas **vaza mensagens de validação em inglês** ("Category is required") — bug de i18n. Nossa régua de validação por campo (PontesField) está no mesmo nível, sem esse furo.
- Pierre **não deixa editar/excluir** nada — alguns usuários odeiam. Nosso CRUD completo é argumento pra quem quer controle.
