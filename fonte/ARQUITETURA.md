# Arquitetura de conteúdo

Como as 17 rotas se dividem o trabalho, o que foi tirado na revisão de
arquitetura e quais regras o `fonte/testes/arquitetura.mjs` cobra a cada build.

```bash
npm run test:arquitetura          # 222 verificações sobre o DOM renderizado
node fonte/testes/arquitetura.mjs public --mapa   # imprime o mapa de seções
```

## O problema que a revisão resolveu

Três blocos entravam em quase toda página, independentemente do que ela
explicava:

| bloco | aparecia em | tamanho |
| --- | --- | --- |
| carrossel de avaliações | 7 rotas | os mesmos 3 depoimentos clonados 12 vezes, ~436 palavras |
| banner do Clube | 8 rotas | — |
| faixa em marquise | todas | decorativa |
| cartões das três unidades no encerramento | todas | repetia a lista que estava logo acima |

Repetição não é consistência: enche a página, empurra a informação útil para
baixo e faz a mesma prova social valer menos a cada vez. O efeito em palavras
de texto renderizado:

| rota | antes | depois |
| --- | --- | --- |
| `/` | 914 | 562 |
| `/unidades/` | 753 | 314 |
| `/unidades/cidade-continental/` | 870 | 338 |
| `/servicos/corte-masculino/` | 820 | 364 |
| `/visagismo/` | 804 | 302 |
| `/cultura/` | 729 | 229 |

Nenhuma rota perdeu informação própria: o que saiu era cópia do que já estava
em outra página, e o que era único mudou de lugar (ver abaixo).

## O papel de cada rota

| rota | função | termina em |
| --- | --- | --- |
| `/` | apresentar a marca, as três unidades, os serviços e levar ao agendamento | CTA curto: agendar ou comparar unidades |
| `/unidades/` | comparar os três endereços e escolher um | agendar / WhatsApp |
| `/unidades/<unidade>/` | tudo de **uma** unidade: endereço, horário, como chegar, serviços, dúvidas | agendar nesta unidade |
| `/servicos/` | catálogo completo + destaques + dúvidas de serviço | escolher serviço e unidade |
| `/servicos/corte-masculino/`, `/servicos/barboterapia/`, `/visagismo/` | um serviço: o que é, como funciona, onde fazer, dúvidas | agendar aquele serviço |
| `/dia-do-noivo/` | consulta com data e número de pessoas | formulário / WhatsApp |
| `/o-clube/` | o que é, como funciona, planos, regras, como assinar | assinar ou visitar antes |
| `/cultura/` | a marca e o jeito de atender | escolher uma unidade |
| `/corporativo/` | planos para empresas e proposta | formulário / WhatsApp |
| `/trabalhe-conosco/` | banco de talentos (não é vaga anunciada) | enviar interesse |
| `/politica-de-privacidade/`, `/termos-de-uso/` | texto jurídico | sem CTA, de propósito |
| `/404.html` | recuperar a navegação | — |

## O que saiu, o que foi condensado, o que mudou de lugar

**Saiu de todas as internas**
- carrossel de avaliações (fica só na Home, estático, três avaliações);
- faixa em marquise (fica só na Home);
- cartões das três unidades no encerramento — o fim de página agora é um
  título curto e dois botões.

**Banner do Clube**: de 8 rotas para 3 (`/servicos/`, `/servicos/corte-masculino/`,
`/servicos/barboterapia/`) — corte e barba é o que a assinatura cobre. Em
unidade, visagismo, noivo, corporativo, carreira e institucional, não tem.

**Galeria**: de 7 rotas para 3, cada uma com um papel — a Home (grade com
lightbox), `/servicos/corte-masculino/` ("Cortes feitos na Morenos") e
`/cultura/` ("O dia a dia na Morenos"). As páginas de unidade perderam a
galeria: as fotos não eram daquela unidade.

**Home**
- dois blocos sobre a experiência viraram um: o `#sobre` saiu e o link
  "Conhecer a Morenos" passou para o bloco da Experiência Morenos;
- depoimentos: três cartões parados no lugar da marquise vertical com clones;
- encerramento compacto, sem repetir os cartões das unidades;
- o FAQ saiu da Home e foi distribuído: perguntas de agendamento e de endereço
  para `/unidades/`, perguntas de serviço para `/servicos/` (que não tinha FAQ),
  perguntas de assinatura para `/o-clube/` (que já tinha).

**Páginas de unidade**: saiu o bloco genérico "O corte começa antes da máquina
ligar", igual nas três e já dito na Home e em `/cultura/`.

**`/trabalhe-conosco/`**: duas perguntas novas deixam claro que a página é
banco de talentos e que o envio acontece pelo WhatsApp.

**Navegação**: Corporativo entrou na barra do desktop; Corporativo e Trabalhe
Conosco entraram no menu do celular (antes só o rodapé levava lá).

**Chamadas**: cada encerramento tem o texto do assunto da página, e o link de
WhatsApp abre com a mensagem do contexto (unidade, serviço, Clube, empresa,
carreira) em vez da mensagem genérica.

## Correções de conteúdo factual

- **Agenda por unidade.** Os três `bookingUrl` são o mesmo link geral
  (`site-config.js`), então o site não diz mais "cada unidade tem a própria
  agenda" nem "a agenda daquela unidade". Quando os links por unidade chegarem,
  o texto pode voltar.
- **Fotos de fachada.** `C.locations[].fotoConfirmada` manda: enquanto for
  `false`, a página não usa a imagem de fachada daquela unidade — um cartão com
  o nome da avenida e uma fachada embaixo afirma que aquele prédio é aquele
  endereço. Entra uma foto do atendimento, com `alt` que não diz onde foi.
  **Sem aviso na tela**: o visitante não precisa saber do nosso inventário.
  Trocar uma foto é mexer em uma linha do `site-config.js`.
- **Recados internos.** `<!-- TODO: confirmar com cliente ... -->` e as notas
  de procedência do `site-config.js` não chegam mais ao HTML publicado (o build
  os retira e diz quantos tirou). Eles continuam no fonte e as pendências estão
  em `fonte/MIGRATION-CHECKLIST.md`.
- **"Esquema ilustrativo — mapa real entra com a localização confirmada"**: o
  recado estava visível no encerramento da Home. Saiu junto com os cartões.
- Uma fonte só para os dados das unidades: a Home lia uma cópia própria da
  lista de endereços; agora lê `MORENOS.locations`, como o resto do site.

## A rolagem das páginas internas

O `support.js` injeta `html,body{height:100%}` em toda página sem `$preview` no
`data-props` — serve ao canvas do Claude Design, onde a página ocupa a moldura.
Publicado, isso prendia a altura do documento no tamanho da janela: **as 16
rotas montadas por componente (todas menos a Home) não rolavam**. O visitante
via o hero e mais nada. O build devolve a altura (`ALTURA_LIVRE` em
`fonte/build.py`) e o teste cobra, rota a rota, que a página role e que o rodapé
seja alcançado.

## Movimento

Quem pede menos movimento no sistema (`prefers-reduced-motion: reduce`) recebe
a página parada: o build publica a regra que zera animação e transição, e o
teste confere que a Home não tem nenhuma animação em laço nesse modo, que a
tela de abertura sai e que o conteúdo aparece.

## As regras que o teste cobra

1. nenhuma seção (mesmo `h2`) em mais de 3 rotas;
2. no máximo um bloco com a lista das três unidades por rota (o hero não conta);
3. encerramento sem os cartões das unidades;
4. nenhum recado interno no texto renderizado;
5. um `<h1>` por rota e `<title>` sem repetir entre rotas;
6. toda rota termina com um próximo passo (menos as jurídicas);
7. toda rota rola e chega ao rodapé;
8. com `prefers-reduced-motion`, nada em laço.
