# video-tour — vídeos de divulgação do Pontes

Gera os vídeos curtos do app (o "brag"): telas **reais** do app rodando + trilha **original** sintetizada.
Dois formatos:

- `horizontal/` — 1920×1080, 21,5 s (plano e storyboard em `horizontal/plano.md`).
- `vertical/` — 1080×1920, 57,5 s, tour pelas telas (Reels/Stories/TikTok).

Cada formato tem `legenda.txt` (texto pra postar) e `composition/index.html` (a animação: cada quadro é
função pura do tempo, `renderAt(t)`).

## Regras

- **Só conta de TESTE do seed** (`dev@controle.test` / `conjuge@controle.test`, dados fictícios). Nunca dado real.
- **Login por variável de ambiente** — nada de senha no código: `BRAG_EMAIL` e `BRAG_SENHA`.
- **Nada gerado vai pro git** (capturas, quadros, áudio, `.mp4`): fica em `*/work/` e nos arquivos finais,
  ignorados pelo `.gitignore` desta pasta. Regenera com os scripts.
- Só mostrar o que **é verdade no app hoje** (sem Open Finance, preços, depoimentos inventados).

## Como gerar (vertical)

> **Desatualizado (2026-10-26):** o tour foi gravado no front v1, arquivado na tag `arquivo/v1-final`. Refazer pro front atual (porta 5174) quando for gravar de novo.

Pré-requisitos: app rodando (`localhost:5173` + API), Playwright instalado (o do `controle-financeiro.web`
serve: rode os scripts com `NODE_PATH` apontando pro `node_modules` dele, ou de dentro dele), Python 3 com
`numpy`, e `ffmpeg` pra juntar quadros + áudio.

```bash
export BRAG_EMAIL=dev@controle.test BRAG_SENHA='<senha da conta de teste do seed>'
cd tools/video-tour/vertical/scripts

node criar-dados-teste.cjs                 # opcional: popula a conta dev@ (parcelamentos, metas...) via API
node capturar-desk.cjs ../work/desk        # telas reais (desktop)
node capturar-mobile.cjs ../work/mobile    # telas reais (celular)
node capturar-recortes-3.cjs ../work/recortes   # recortes usados na composição (../work/recortes/)
python audio_v2.py ../work/audio.wav       # trilha original (57,5 s)
node render.cjs frames                     # ../work/frames/f_00000.jpg … (30 fps)
```

Juntar (comando padrão do ffmpeg — conferir o nome do áudio/saída):

```bash
ffmpeg -framerate 30 -i ../work/frames/f_%05d.jpg -i ../work/audio.wav \
  -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest ../brag-vertical.mp4
```

Pra conferir quadros soltos antes de renderizar tudo: `node render.cjs stills 1.0,2.6,10.4`.

> Os argumentos de saída dos scripts de captura e do `audio_v2.py` estão no topo de cada arquivo — confira
> antes de rodar (foram escritos numa sessão de 2026-10-05 e trazidos pra cá sem alteração).
