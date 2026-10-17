# Auditoria de SEO — out/2026

O registro completo está em **`fonte/auditoria-seo-achados.json`**: 78 achados,
cada um com rota, arquivo, evidência reproduzível, impacto e a correção
proposta. Este documento é o resumo e a separação que a auditoria pedia.

## Como foi feita

Seis frentes de auditoria em paralelo sobre o repositório e sobre o site
gerado — ambiente e indexação, rotas e respostas HTTP, dados estruturados,
metadados e copy, links internos, páginas de unidade — cada uma lendo o código
**e** o DOM renderizado num Chromium, depois da troca das duas camadas. Uma
sétima frente (desempenho) foi medida à parte; está em `fonte/DESEMPENHO.md`.

Cada achado precisava de evidência produzida na hora: saída de comando, trecho
de arquivo com linha, ou estado do DOM. Uma rodada de verificação adversarial
(um cético por achado, com instrução de derrubar) foi aberta e interrompida
depois de 4 vereditos — todos CONFIRMADO — porque as correções já estavam
implementadas e verificadas pelas três suítes automáticas do projeto. **A
auditoria não é um relatório de opinião: 702 verificações automáticas cobrem
hoje o que ela encontrou.**

Limite honesto: **este ambiente não alcança os domínios do cliente** (o DNS
está bloqueado aqui). Nada do que está no ar foi inspecionado diretamente —
nem `salaomorenos.com.br`, nem `novosite.salaomorenos.com.br`. O que foi
auditado é o repositório e o site que ele gera, que é o mesmo artefato que
sobe. O que depende de olhar o site publicado está marcado abaixo.

## 1. Problemas comprovados (35)

Os sete P0, que são de ambiente e indexação:

| # | problema | situação |
| --- | --- | --- |
| 1 | `ErrorDocument 404 /index.html`: qualquer URL errada devolvia a **home inteira** — mesmo título, mesmo H1, mesmo canonical. O `404.html` gerado a cada build nunca era servido | corrigido |
| 2 | O `public/` versionado — o que foi para o subdomínio — é um build de **produção**: indexável, canonical apontando para o domínio principal | corrigido (ambiente explícito) |
| 3 | O robots de homologação usava `Disallow: /` **junto** com o noindex: o robô nunca chegava a ler o noindex | corrigido |
| 4 | Nenhuma das 293 verificações existentes cobria ambiente ou indexação | corrigido (trava no build + suíte nova) |
| 5 | A mesma unidade real existia como **duas entidades diferentes** no JSON-LD (`/#cidade-continental` na Home, `/unidades/cidade-continental/#unidade` na página) | corrigido |
| 6 | Na Home, a `url` das três unidades apontava para a **própria Home** | corrigido |
| 7 | `image` de duas unidades declarava foto que o próprio `site-config.js` marca como não confirmada | corrigido |

Os P1 e P2 comprovados, resumidos por frente:

- **Indexação**: noindex injetado por JavaScript (o robô lê o HTML, não espera
  o script); `.htaccess` igual nos dois ambientes, sem `X-Robots-Tag`; os três
  componentes em `/_dc/` servidos como páginas indexáveis, com `{{ }}` crus.
- **Rotas**: deploy aditivo (`cp -R`), que nunca remove URL apagada; sitemap
  escrito à mão, sem `lastmod`; `/pasta/index.html` respondendo 200 em paralelo
  a `/pasta/`.
- **Dados estruturados**: sem `Organization` nem `WebSite` com `@id`;
  `parentOrganization` como objeto anônimo repetido; páginas jurídicas com
  migalha na tela e sem `BreadcrumbList`.
- **Conteúdo**: a Política de Privacidade declarava Google Fonts como terceiro
  depois de o build passar a servir a fonte do próprio domínio; Home e
  `/o-clube/` se contradiziam sobre em quais unidades o assinante é atendido;
  dois planos pagos com nome idêntico; horário publicado duas vezes na mesma
  página em 4 rotas; endereço repetido de 3 a 6 vezes por página de unidade;
  a diferença entre barboterapia e barba alinhada só existia dentro do FAQ;
  FAQ repetindo a duração que o corpo acabou de dar; description da Home
  cortada aos 206 caracteres; abertura do corte copiada do catálogo.
- **Links**: a seção do Clube na Home não levava a `/o-clube/`; `/unidades/`
  era a única rota fora do rodapé; "Unidades" e "Serviços" no cabeçalho eram
  botões sem `href`; nenhuma página de serviço levava a outra; `/cultura/` não
  levava a Corporativo nem a Trabalhe Conosco.
- **Unidades**: o "Agendar" do cabeçalho jogava fora a unidade da página;
  "Como chegar" abria uma **busca** no Maps, não a rota; o WhatsApp do bloco de
  informações abria a conversa sem dizer de qual unidade.

## 2. Melhorias recomendadas (30)

Implementadas: sitemap gerado das rotas reais com `lastmod` vindo do git;
`ItemList` ligando `/unidades/` às três páginas; `Service` nas quatro páginas
de serviço; 301 de `/pasta/index.html`; `DirectorySlash` explícito; `srcset`
da foto de abertura; `aria-label` por unidade nos links repetidos; Open Graph
nas duas páginas jurídicas; títulos de `/corporativo/` e `/cultura/`.

Não implementadas, por decisão: as cinco pastas de assets respondem 403 em vez
de 404 (sem efeito de busca); `og:title`/`og:description` iguais ao título e à
description (é o comportamento correto quando não há arte de compartilhamento
própria).

## 3. Depende do cliente (11)

Lista completa, separada por unidade, em **`fonte/MIGRATION-CHECKLIST.md`**.
Em resumo: número do imóvel de duas unidades, telefone e horário por unidade,
link do Perfil da Empresa, link de agendamento por unidade, lista de serviços
por endereço, fotos identificadas, grafia oficial do nome, preços avulsos,
história e equipe para a página Sobre, procedência dos três depoimentos.

**Nada disso virou texto inventado nem placeholder na tela.** Onde o dado falta,
a página diz menos — e o que ela diz é verdade.

## 4. Só na publicação definitiva (2)

- Auditar os sitemaps do WordPress antigo (posts, categorias, ElementsKit) e
  decidir o destino de cada URL: `npm run auditar:site-antigo https://salaomorenos.com.br`,
  rodado de uma máquina que alcance o domínio.
- Conferir no domínio final o que só existe lá: canonical resolvendo 200,
  404 real, redirecionamentos 301, Search Console, sitemap enviado.

Roteiro completo em **`fonte/MIGRACAO.md`**.

## O que a auditoria NÃO encontrou

Vale registrar, porque é o que costuma estar errado: zero texto escondido,
zero bloco de palavra-chave, zero lista artificial de bairros, zero promessa de
posição no Google, zero `aggregateRating` tentando estrela com depoimento
próprio, zero link interno quebrado, zero rota órfã, zero `{{ }}` cru em página
publicada, e os 42 blocos de JSON-LD eram todos sintaticamente válidos.
