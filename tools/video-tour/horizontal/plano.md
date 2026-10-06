# /brag — Pontes (plano)

**Formato:** horizontal 1920×1080, 30 fps, 21,5 s · **Tom:** `polished` (sério, elegante, pausas longas) com cara de card de produto · **Áudio:** trilha original sintetizada (sem música de terceiros) + efeitos no mesmo tom.

## Rubrica
- **O que é:** app de finanças pra casal e família — rateio, acerto do mês, conta privada respeitada.
- **Pra quem:** casais/famílias brasileiros que brigam por dinheiro e vivem de planilha.
- **Diferencial:** divide as despesas da casa (pela renda, se quiser) **sem expor a renda de ninguém**, e diz quem está a acertar e quem tem a receber.
- **Claim mais forte (real, no código):** "Dinheiro de casal sem briga." (copy do site `/casais`).
- **Gancho visual:** a frase do site em tipografia grande + o arco do logo se desenhando embaixo de "sem briga.".
- **UI real mostrada:** Dashboard (captura real), "Balanço do mês" da família (a acertar / a receber), conferir saldo da Reconciliação (digitando o valor do banco → Diferença R$ 0,00 ✓).
- **Fora (não é verdade ainda):** Open Finance / "conecte seus bancos", preços, depoimentos e números de marketing do site.
- **Dados:** só a conta de TESTE do seed (`dev@` / `conjuge@`, dados fictícios). A parte "Membros" da família não entra (o app rodando ainda é o código antigo que mostra a renda do outro).
- **Legenda pra postar:** ver `share-copy.txt`.

## Storyboard (durações somam 21,5 s)
| # | Tempo | Cena | Texto na tela | Movimento / som |
|---|---|---|---|---|
| 1 | 0,0–3,4 | **Gancho** — fundo cobalto | "Dinheiro de casal" / ***sem briga.*** (âmbar, Fraunces itálico) | palavras sobem; arco do logo se desenha sob "sem briga."; whoosh + acorde |
| 2 | 3,4–6,8 | **Revelação** — fundo claro | logo Pontes + "Finanças pra casal e família." | Dashboard real entra de baixo em perspectiva e aproxima devagar |
| 3 | 6,8–11,0 | **Destaque 1 — acerto** | ACERTO DO MÊS · "Quem pagou o quê." · "E quanto falta pra equilibrar." | card real "Balanço do mês" desliza; brilho âmbar em "a acertar" e verde em "a receber"; ding |
| 4 | 11,0–14,4 | **Destaque 2 — renda** | RATEIO · "Divide pela renda." · ***Sem mostrar a renda.*** | dois membros (GD/MD) com barras de cota crescendo; cadeado "só você vê a sua" |
| 5 | 14,4–18,4 | **Destaque 3 — reconciliação** | RECONCILIAÇÃO · "Confere com o banco." · "Centavo por centavo." | painel real; digitação "1.543,38" na máscara (0,01→1.543,38) com tique por dígito; vira ✓ R$ 0,00 com pulso verde; chime |
| 6 | 18,4–21,5 | **Fechamento** — cobalto | logo Pontes (arco se desenha) · "Dinheiro de casal ***sem briga.***" · selo "Beta aberto" | logo cresce suave; acorde final + brilho; segura até o fim |

Transições: cenas claras entram/saem em sequência (sai o conteúdo, depois entra o novo); claro↔escuro passa pela cor de fundo (sem fusão suja).

## Identidade (do código)
- Cores (`tokens.css`, paleta A): cobalto `#1E40AF` / `#1E3A8A`, âmbar `#F59E0B`, fundo `#F7F9FC`, texto `#0B1220`, verde `#10B981`, vermelho `#DC2626`.
- Fontes: Inter (UI), Fraunces itálico (ênfase do site), Plus Jakarta Sans 700 (logo, `letter-spacing -0.035em` + arco `M4 12 Q100 -4 196 12`).

## Música
100 BPM, Dó maior suave (Cmaj9 → Am9 → Fmaj9 → G6sus), pad quente + arpejo em pluck + bumbo leve a partir da cena 2; efeitos (whoosh, tique, ding, chime) afinados na mesma tonalidade e mixados por baixo.
