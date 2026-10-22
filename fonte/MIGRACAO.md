# Migração para salaomorenos.com.br

O site novo está em `novosite.salaomorenos.com.br`, que é **provisório e serve só
para aprovação**. O destino é `salaomorenos.com.br`, onde hoje roda o WordPress
antigo. Este documento é o roteiro da troca — nada aqui foi executado.

> **Nada foi publicado no domínio principal.** Esta etapa termina com o site
> aprovado no subdomínio e esta lista pronta para o dia da virada.

## Os dois ambientes

| | homologação | produção |
| --- | --- | --- |
| endereço | `novosite.salaomorenos.com.br` | `salaomorenos.com.br` |
| build | `python3 fonte/build.py --homologacao` | `python3 fonte/build.py` |
| indexação | `noindex, nofollow` no HTML e no cabeçalho HTTP | sem noindex |
| robots.txt | libera o rastreio (senão o robô nunca lê o noindex) | libera o rastreio |
| sitemap.xml | **não é publicado** | publicado e declarado no robots.txt |
| canonical | aponta para o próprio subdomínio | aponta para o domínio final |

O ponto que costuma passar: **`Disallow: /` não serve para tirar um site do
índice**. Ele impede o robô de abrir a página — e, sem abrir, o robô nunca lê o
`noindex`. A URL continua podendo aparecer na busca, só que sem título nem
descrição. Por isso a homologação libera o rastreio e bloqueia a indexação.

## Mapa de URLs

As nove rotas do site antigo são preservadas com o mesmo endereço. Sem
redirecionamento, sem perda de histórico:

| URL antiga | URL nova | o que acontece |
| --- | --- | --- |
| `/` | `/` | preservada |
| `/unidades/` | `/unidades/` | preservada |
| `/servicos/` | `/servicos/` | preservada |
| `/visagismo/` | `/visagismo/` | preservada |
| `/dia-do-noivo/` | `/dia-do-noivo/` | preservada |
| `/o-clube/` | `/o-clube/` | preservada |
| `/cultura/` | `/cultura/` | preservada |
| `/corporativo/` | `/corporativo/` | preservada |
| `/trabalhe-conosco/` | `/trabalhe-conosco/` | preservada |

Páginas novas, sem equivalente antigo (nascem agora, nada a redirecionar):

`/unidades/cidade-continental/` · `/unidades/novo-horizonte-av-brasil/` ·
`/unidades/novo-horizonte-av-industrial/` · `/servicos/corte-masculino/` ·
`/servicos/barboterapia/` · `/politica-de-privacidade/` · `/termos-de-uso/`

### O que ainda falta mapear

O WordPress antigo publica mais que essas nove rotas: posts, categorias, tags,
anexos de mídia e as páginas que o ElementsKit gera. **Este ambiente de
desenvolvimento não alcança o domínio do cliente** (o DNS está bloqueado aqui),
então não pude inventariar nada disso — e inventar a lista seria pior que não
ter.

Para levantar, de uma máquina que alcance o site:

```bash
node fonte/scripts/auditar-site-antigo.mjs https://salaomorenos.com.br
```

O script lê o `robots.txt`, segue cada sitemap declarado (inclusive os filhos de
um índice), abre cada URL e escreve um CSV com status, redirecionamento, title,
description, canonical e meta robots — e sugere, para cada uma, se a URL é
**preservada**, **redirecionada** (para onde) ou precisa de **decisão**.

Regras para decidir as linhas "DECIDIR":

- **Não redirecione tudo para a home.** Redirecionamento em massa para a raiz é
  tratado como página não encontrada e joga fora o histórico da URL.
- Post ou página antiga com conteúdo útil: ou vira uma página nova (e a URL
  antiga redireciona para ela), ou redireciona para a página mais próxima do
  assunto. Se não existe destino próximo, deixe responder 404 — 404 honesto é
  melhor que redirecionamento enganoso.
- Categoria, tag e arquivo por data raramente têm destino: 404 ou 410.
- **Mídia**: imagem antiga ainda usada em outro lugar (Google Imagens, link de
  rede social) vale preservar no mesmo caminho ou redirecionar. Apagar imagem
  sem redirecionar é perda silenciosa.

## Dia da publicação, na ordem

1. **Antes de trocar**, com o site novo ainda no subdomínio:
   - `python3 fonte/build.py` (sem `--homologacao`)
   - `node fonte/checar.mjs public` — entre as verificações, uma falha o build
     se sobrar `noindex` em produção.
   - `node fonte/testes/arquitetura.mjs public`
   - `node fonte/testes/grades.mjs public` — nenhuma galeria ou grade de
     cartões com célula vazia, em nove larguras de tela.
   - Conferir que `public/robots.txt` libera o rastreio e declara o sitemap do
     domínio final, e que `public/sitemap.xml` só tem URL do domínio final.
2. **Fazer backup do WordPress** (arquivos + banco) antes de qualquer coisa.
3. Publicar o site novo no document root de `salaomorenos.com.br`.
4. Conferir **na hora**, no domínio final:
   - a home responde 200 e aparece inteira;
   - cada uma das 16 rotas responde 200;
   - uma URL inventada (`/pagina-que-nao-existe/`) responde **404**, não 200;
   - `view-source:` de três páginas: **sem** `noindex`, canonical absoluto e
     autorreferente, um só canonical;
   - `https://salaomorenos.com.br/robots.txt` e `/sitemap.xml` abrem.
5. Aplicar os redirecionamentos decididos no CSV (no `.htaccess`), e testar cada
   um com `curl -I`: tem que responder **301**, não 302.
6. **Search Console**:
   - verificar a propriedade do domínio (se ainda não estiver verificada);
   - enviar `https://salaomorenos.com.br/sitemap.xml`;
   - **não** enviar o sitemap do subdomínio;
   - pedir indexação das páginas principais pela inspeção de URL.
7. **Perfis da Empresa no Google**: apontar o campo "site" de cada unidade para
   a página daquela unidade (ver `fonte/PERFIS-GOOGLE.md`).
8. Conferir se algum link externo (Instagram, WhatsApp, cardápio de parceiro,
   Cashbarber) aponta para uma URL antiga que mudou.

## Depois do subdomínio sair do ar

Quando o site novo estiver no domínio principal, o subdomínio não deve ficar
servindo uma cópia:

- **Preferido**: apontar `novosite.salaomorenos.com.br` para o domínio
  principal com 301, página a página.
- **Alternativa**: desativar o subdomínio (ele passa a não resolver).
- **Não** deixe o subdomínio no ar com o mesmo conteúdo: duas cópias do mesmo
  site competindo é o cenário que o `noindex` de homologação existe para evitar.

## Acompanhar nas semanas seguintes

- Search Console → Páginas: o que está indexado, o que foi excluído e por quê.
- Search Console → erros 404: cruzar com o CSV; URL antiga com tráfego que caiu
  em 404 merece um redirecionamento que ninguém previu.
- Conferir que nenhuma URL do subdomínio aparece na busca (`site:novosite.salaomorenos.com.br`).
- Comparar as páginas que recebiam visita antes e depois. **Queda nas primeiras
  semanas é comum numa troca de site**; o que importa é a curva voltar.

Não há promessa de posição aqui. O que este roteiro garante é que a troca não
perca o que já existe — e isso é a parte que depende de nós.
