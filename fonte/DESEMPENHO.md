# Desempenho — o que foi medido

**Medição de laboratório, não dado de campo.** Tudo aqui foi medido num
Chromium local servindo `public/` com gzip (como o Apache da hospedagem faz),
em viewport de celular 390×844 com `deviceScaleFactor: 2`, rede limitada a
1,6 Mbps / 150 ms de latência e CPU 4× mais lenta, pelo Chrome DevTools
Protocol.

Isso **não é a nota do PageSpeed** e **não é dado de usuário real** (CrUX).
Serve para comparar antes e depois da mesma mudança, na mesma régua. O número
que vale para o Google é o do visitante de verdade, que só aparece depois da
publicação, no Search Console e no PageSpeed com dados de campo.

## Antes e depois

| rota | LCP antes | LCP depois | peso | imagens |
| --- | --- | --- | --- | --- |
| `/` | 5292 ms | **1724 ms** | 1084 KB | 595 KB |
| `/unidades/cidade-continental/` | 1648 ms | 1556 ms | 727 KB | 247 KB |
| `/servicos/corte-masculino/` | 1668 ms | 1448 ms | 914 KB | 427 KB |
| `/o-clube/` | 1576 ms | 1316 ms | 788 KB | 274 KB |

A Home caiu de 5,3 s para 1,7 s por três motivos somados:

1. **A foto de abertura estava marcada `loading="lazy"`.** A pré-renderização
   dava prioridade alta à *primeira imagem do DOM* — que é a logo do cabeçalho —
   e marcava todo o resto como adiável, inclusive a imagem que decide o LCP.
   Agora o alvo é a imagem que o design marcou como prioritária dentro do
   `<main>`, e só o que nasce abaixo da primeira dobra vira `lazy`.
2. **A foto tinha 1672 px de largura para um celular de 390 px.** O build gera
   versões de 900 px (62 KB) e 1200 px (82 KB) e entrega `srcset`: no celular,
   62 KB em vez de 143 KB.
3. **O `<link rel="preload">` da mesma imagem baixava a original** e anulava o
   `srcset`. Agora ele leva `imagesrcset`/`imagesizes` e combina com a `<img>`.

## A tela de abertura

Ela é o que mais atrasa o acesso ao conteúdo, e isso é escolha de marca, não
defeito. Medido, na mesma régua:

| rota | conteúdo pintado (LCP) | tela de abertura sai |
| --- | --- | --- |
| `/` | 1724 ms | 3412 ms |
| `/unidades/cidade-continental/` | 1556 ms | 2887 ms |
| `/o-clube/` | 1316 ms | 2832 ms |

O que foi cortado nesta revisão:

- a tela esperava `window.load`, que só acontece quando **toda** imagem que a
  página começou a buscar termina — inclusive a que está a três rolagens de
  distância. Agora a espera tem teto de 1,5 s depois de o resto estar pronto;
- o teto de segurança caiu de 6 s para 3,5 s;
- a saída (logo acesa + fade) caiu de 940 ms para 660 ms.

O que sobra é deliberado: 1,2 s de intro na primeira carga da sessão
(`minimumVisibleTime`), a espera pela imagem principal e a espera pela troca
das duas camadas — sem ela, o visitante vê a página trocar na frente dele.

**Os dois botões que o cliente pode girar**, se quiser priorizar velocidade
sobre a abertura de marca (em `fonte/prototipo/site-config.js`):

- `minimumVisibleTime: 1200` → `0` tira a espera mínima da primeira carga;
- `repeticao`/modo curto já está em 0 ms de espera mínima nas páginas seguintes.

Nas cargas seguintes da mesma aba, a tela já usa o modo curto (~0,6 s).

## O que não foi mexido, e por quê

- **O runtime do Claude Design (215 KB de JavaScript)** continua indo para o
  navegador: é ele que devolve mega menu, modal, abas, acordeão e lightbox
  depois da cópia estática. Trocar isso por JavaScript comum seria manter uma
  segunda implementação do design, que divergiria na primeira reexportação.
  Como o conteúdo já vem pronto no HTML, esse JavaScript não bloqueia a
  leitura — ele chega depois.
- **O HTML tem o conteúdo duas vezes** (cópia estática + template). São
  ~220 KB crus na Home, mas ~35 KB comprimidos, que é o que trafega.
- **As outras fotos (720–1000 px)** aparecem em cartões de 390–420 px: em tela
  de alta densidade elas já estão no tamanho certo. Gerar variantes menores
  economizaria pouco e aumentaria o número de arquivos.
- **O mapa das páginas de unidade** é um `<iframe>` do Google Maps com
  `loading="lazy"`: só carrega quando a pessoa chega perto dele.

## Como repetir a medição

O script de medição não está versionado de propósito (é ferramenta de
diagnóstico, não parte do site). Para refazer: sirva `public/` com gzip, abra
cada rota no Chromium com a limitação acima e leia `largest-contentful-paint`
pelo `PerformanceObserver`. O importante é medir **sempre na mesma régua** —
comparar uma medição com gzip contra outra sem gzip dá uma diferença de ~6×
no HTML e não quer dizer nada.
