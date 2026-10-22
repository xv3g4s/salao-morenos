# Fotos e clipes

## O que entrou (out/2026)

Oito fotos e dois clipes enviados pelo cliente, todos de **trabalho pronto** —
corte finalizado, feito na loja. Nenhuma mostra fachada, e por isso **nenhuma
resolve a pendência das fotos de unidade**: continuam valendo as regras de
`C.locations[].fotoConfirmada` (ver `fonte/MIGRATION-CHECKLIST.md`).

| arquivo | onde aparece |
| --- | --- |
| `corte-crespo-degrade.webp` | galeria da Home |
| `corte-degrade-baixo.webp` | galeria da Home |
| `corte-texturizado.webp` | galeria da Home |
| `corte-infantil-degrade.webp` | galeria da Home |
| `corte-quiff-loiro.webm` + `.mp4` + `-poster.webp` | galeria da Home (clipe) |
| `corte-penteado-para-tras.webp` | galeria de `/servicos/corte-masculino/` |
| `corte-maquina-risco.webp` | galeria de `/servicos/corte-masculino/` |
| `corte-volume-barba.webp` | galeria de `/servicos/corte-masculino/` |
| `cabelo-longo-barba.webp` | galeria de `/servicos/corte-masculino/` |
| `corte-cacheado.webm` + `.mp4` + `-poster.webp` | galeria de `/servicos/corte-masculino/` (clipe) |

**Cada arquivo aparece em uma rota só.** Antes, a mesma galeria de quatro fotos
se repetia em duas páginas e as fotos de ambiente apareciam em até doze rotas.
Agora são três galerias com conteúdo diferente:

- **Home** — trabalho pronto (4 fotos + 1 clipe);
- **`/servicos/corte-masculino/`** — trabalho pronto, outro conjunto (4 + 1);
- **`/cultura/`** — o dia a dia da loja (as fotos de ambiente que já existiam).

## Como as fotos foram preparadas

```bash
convert original.JPG -auto-orient -strip -resize 840x \
  -gravity center -crop 840x1050+0-60 +repage -quality 78 saida.webp
```

- **`-strip` não é opcional**: as originais vinham com GPS do celular. Publicar
  foto de cliente com a coordenada da loja embutida é vazamento de dado, e
  ainda entregaria o endereço exato de uma unidade que o site nem confirma.
- 840 px de largura: a célula da galeria tem ~420 px, e 840 cobre tela de alta
  densidade. O recorte 4:5 tira o excesso de altura (as originais são 9:16) —
  altura que a célula cortaria de qualquer jeito, mas que o visitante baixava.

## Como os clipes foram preparados

```bash
ffmpeg -i original.MOV -an -c:v libvpx-vp9 -crf 36 -b:v 0 \
  -vf "scale=720:-2,fps=24" -row-mt 1 -deadline good -cpu-used 2 \
  -pix_fmt yuv420p saida.webm
ffmpeg -i original.MOV -an -c:v libx264 -crf 30 -preset slow \
  -vf "scale=720:-2,fps=24" -movflags +faststart -pix_fmt yuv420p saida.mp4
ffmpeg -ss 0.3 -i original.MOV -frames:v 1 -vf scale=720:-2 cartaz.png
```

`-an` **não é "mudo no player": é sem faixa de áudio no arquivo**. Não existe
som para alguém ligar. O WebM é o principal; o MP4 existe para o Safari antigo,
e o navegador baixa só um dos dois (`canPlayType` decide).

## Como o clipe se comporta

A regra é "igual a um GIF": aparece, roda sozinho, repete, não faz som e não
tem com o que interagir.

- `autoplay`, `loop`, `muted`, `playsinline`, sem `controls`;
- `pointer-events: none` — clique e toque não fazem nada;
- `disablepictureinpicture`, `disableremoteplayback`, `controlslist`;
- **carrega só quando chega perto da tela** (`IntersectionObserver`, margem de
  200 px) e **pausa quando sai**. Carregando junto com a página, os 300 KB do
  clipe disputavam banda com a foto de abertura e atrasavam a primeira tela em
  mais de 3 s numa rede de celular;
- com `prefers-reduced-motion: reduce`, o clipe **não aparece**: fica o cartaz
  parado (regra no `<head>`, escrita pelo build).

Duas armadilhas que custaram tempo e ficam registradas:

1. **React trata `muted`, `loop` e `controls` como propriedade, não como
   atributo.** Escrever `muted` no template não basta: o clipe nasce com som e
   o navegador recusa o autoplay. Quem acerta isso é o `ligarClipes()` nos dois
   componentes.
2. **O endereço do arquivo não pode estar no template.** O HTML cru fica na
   página junto com a cópia estática, e o navegador tenta buscar `{{ g.webm }}`
   ao pé da letra — três 404 por página. Por isso o caminho vai em `data-webm`
   e o `src` é escrito pelo JavaScript.

`fonte/testes/arquitetura.mjs` cobra tudo isso rota a rota: mudo, em laço, sem
controle, inerte ao clique, rodando sozinho, com cartaz, e parado no modo de
movimento reduzido.

## O que ainda falta

- **Autorização de imagem.** As fotos e os clipes mostram rosto de cliente.
  Confirmar com a Morenos que há autorização de uso de imagem para publicação
  no site — está registrado em `fonte/MIGRATION-CHECKLIST.md`.
- **Fotos de fachada** das duas unidades de Novo Horizonte: nenhuma das novas
  serve, porque nenhuma mostra a fachada.
- Uma foto (`IMG_2019.HEIC`) veio **corrompida**: o arquivo referencia um mapa
  de profundidade que não existe dentro dele, e nem o ImageMagick nem o ffmpeg
  conseguem abrir. Reenviar essa em JPEG.
