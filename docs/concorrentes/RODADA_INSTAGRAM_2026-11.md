# Rodada de concorrentes do Instagram (2026-11-03)

Seis perfis que o Gustavo viu anunciando controle financeiro. Só a **fase 1** do `PROCESSO.md` (site público, lido por WebFetch); ninguém foi testado por dentro. Fato separado de opinião.

## Fatos (o que o site diz)

| App | Gancho | Casal/família | Open Finance | Preço | Empresa |
|---|---|---|---|---|---|
| **Junta Já** (juntaja.com.br) | "Seu mês, junto e entendido": manda fatura/extrato (PDF, OFX, XLS, até PDF com senha), IA (Gemini) categoriza, separa pagamento de fatura e transferência, assistente "Ari", WhatsApp | Plano Família: várias pessoas no mesmo painel, gasto por pessoa (fala em "casa", não casal) | Não, de propósito ("sem senha de banco", não guarda o documento) | Individual R$ 19,90/mês (anual), Família R$ 29,90/mês, 7 dias grátis; créditos avulsos | CNPJ 66.269.362/0001-90, RJ. Web + WhatsApp |
| **NivelOn** (nivelon.com.br, mapa: `nivelon/README.md`) | Contabilidade da empresa no app: nota fiscal, DAS calculado com aviso, teto do MEI, guias, certificado digital grátis | Não | Não citado | MEI R$ 49,90, Simples serviço desde R$ 149,90, comércio R$ 349,90; Pix Automático; 30 dias grátis | Escritório Marçal Assessoria (CNPJ 50.687.166/0001-04, Curitiba), contador CRC. Só app (iOS/Android) |
| **DuoFi** (duo-fi.com) | "Finanças do casal, sem brigas": divisão proporcional à renda, metas conjuntas, "seu, meu, nosso" | Só casal (2 pessoas) | Não, tudo manual | Free (50 lançamentos/mês, 2 metas); DuoFi+ R$ 14,90/mês ou R$ 119/ano; "founder" 50% vitalício | Expert Vision (CNPJ 57.103.280/0001-80). Web + PWA |
| **SplitApp** (splitapp.me) | Dividir conta entre amigos/república/viagem, sem cadastro, grátis, scanner de recibo com IA | Grupos (não é casal) | Não | Grátis, sem anúncio | Estrangeiro (inglês), sem empresa no site. Web, iOS, Android |
| **Calen** (usecalen.com.br) | "Quanto sobra no mês antes de você gastar": calendário com saldo previsto dia a dia, fatura do mês com parcelas | Espaço do casal; Plus tem pessoal + casal + família; convidar com "só vê" ou "edita" | Sim (Pluggy), 1 banco no Pessoal, 5 no Plus, ilimitado no Pro | Pessoal R$ 29,90 (R$ 149/ano), Plus R$ 35,90 (R$ 289,90/ano), Pro R$ 65,90 (R$ 589/ano, tem PJ) | 4 mil+ usuários, 4,9 na App Store (59 notas). Também MCP pra ChatGPT/Claude, trilha de educação |
| **Controladin** (controladin.com.br) | Sem site público: o link cai direto no cadastro (com código de indicação) | ? | ? | ? | Sem dado. Cadastro pede senha 12+ com maiúscula/número/símbolo (contra o NIST) |

## Opinião (o que importa pra nós)

- **O mais perigoso é o Calen.** É quase a nossa tese: "vai dar?" com o previsto, casal e família com papéis (só vê / edita), PJ no plano Pro, IA que responde com os números. Ele já tem Open Finance e app nas lojas, e cobra de R$ 29,90 a R$ 65,90. Merece a análise completa (fases 2 a 4 do `PROCESSO.md`).
- **DuoFi é o mais parecido no casal** (divisão proporcional à renda), mas é raso: 2 pessoas, manual, sem parte gravada nem acerto. O preço de referência do casal é R$ 14,90.
- **Junta Já** prova que "mandar o PDF da fatura" é um caminho sem Open Finance que as pessoas aceitam. A gente lê OFX/CSV, mas não lê **PDF de fatura**, que é o que todo banco manda.
- **NivelOn** é o eixo empresas, no modelo "A gente faz" com contador CRC. Bate com `docs/features/empresas/visao.md` §0 (escritório parceiro assinando). Também é a referência de preço do MEI: R$ 49,90.
- **SplitApp** é Splitwise, pra amigos. Não compete com casal/família.
- **Controladin:** sem nada público, ainda não dá pra avaliar.

## O que defender (nosso fosso, ninguém dos seis tem tudo)

Parte de cada um GRAVADA ao dividir, acerto entre vocês com confirmação, quem só vê fora da divisão, renda com visibilidade por pessoa, conta e cartão da casa, o "vai dar?" respondido pelo servidor.

## Gaps que apareceram (pra Fila)

- Ler **PDF de fatura** do cartão (Junta Já; todos os bancos mandam). Médio a grande.
- **Calendário de saldo previsto dia a dia** (Calen). Já temos o previsto do mês (`DinheiroDoMesService`); falta a linha do tempo.
- Analisar o **Calen a fundo** (fases 2 a 4).
- Preço: casal no DuoFi a R$ 14,90; família no Junta Já a R$ 29,90; Calen com casal a R$ 35,90.
