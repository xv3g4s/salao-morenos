# Handoff: site Salão Morenos (14 páginas)

## Visão geral
Novo site institucional e de conversão do Salão Morenos, barbearia com três unidades em Serra — ES (Cidade Continental; Novo Horizonte — Av. Brasil; Novo Horizonte — Av. Industrial). Vai substituir o WordPress atual em salaomorenos.com.br. Objetivos: atender quem já busca a marca pelo nome, captar buscas locais ("barbearia em Serra", "corte masculino em Serra"...) e levar ao agendamento (Cashbarber), à assinatura do Clube (Cashbarber) e ao WhatsApp.

## Sobre os arquivos
Os arquivos em `prototipo/` são **referências de design feitas em HTML** — protótipos que mostram aparência, conteúdo e comportamento. **Não são código de produção.** A tarefa é recriar o site num framework adequado. Recomendação: **Astro** (ou Next.js com SSG), gerando HTML estático pré-renderizado por rota.

Os `.dc.html` usam um runtime próprio (`support.js`) que monta o conteúdo no navegador a partir de templates com `{{ }}`. Por isso o HTML cru contém marcadores `{{ }}` — **o motivo principal da migração para Code é eliminar isso com pré-renderização** (requisito de SEO). Para ver o protótipo funcionando, sirva a pasta `prototipo/` por HTTP (ex.: `npx serve prototipo`) e abra `Home.dc.html`.

## Fidelidade
**Alta fidelidade.** Cores, tipografia, espaçamentos, botões, animações e textos são finais (exceto dados marcados `needsConfirmation`). Recriar fielmente.

## Fonte única de dados — `prototipo/site-config.js`
Toda informação de negócio está ali e deve virar o módulo de dados do projeto (ex.: `src/data/site.ts`):
- `env.stage`: `homologacao` aplica `noindex, nofollow` (detecta hostname `novosite.*`). Em produção: sem noindex. Controlar por variável de ambiente.
- `links.booking` = https://cashbarber.com.br/salaomorenos/inicio (agendamento geral). `links.membership` = https://cashbarber.com.br/salaomorenos (Clube).
- `whatsapp.phone` = 5527998713993; `waLink(msg)` monta `https://wa.me/<phone>?text=<encodeURIComponent(msg)>`.
- `hours`: seg–sex 08:00–20:00, sáb 09:00–18:00 (legacy, a confirmar). Domingo não informado: não exibir.
- `locations`: 3 unidades (nome, logradouro, bairro, CEP, foto, `bookingUrl` null → cai no agendamento geral, `googleProfile` null → rota via busca do Google Maps pelo endereço, `mapaEmbed`).
- `services`: 16 serviços, 4 categorias (cabelo, barba, estética, consultoria), duração; sem preços.
- `clubPlans`: 7 planos (únicos), filtros `ilimitados | custo | familia`.
- `corporatePlans`: 4 formatos.
- `contactFlows`: mensagens iniciais de WhatsApp (noivo, corporativo, carreira).
- `analytics` + `track(evento, dados)`: faz push em `window.dataLayer` se existir. Eventos: booking_click, membership_click, whatsapp_click, unit_select, route_click, service_view, club_plan_click, corporate_lead, groom_lead, career_lead. Sem IDs de GTM/GA4 (preencher depois).
- `selectedUnitKey` = `morenos_selected_unit` em localStorage (só conveniência).
- `routes` (arquivos do protótipo) e `paths` (URLs finais).

Campos com `source: "legacy-site"` / `needsConfirmation: true` vieram do site antigo: manter a marcação no código. Ver `MIGRATION-CHECKLIST.md`.

## Rotas (preservar as URLs atuais do WordPress)
| Rota | Arquivo do protótipo | Title |
|---|---|---|
| / | Home.dc.html | Salão Morenos \| Barbearia em Serra, ES |
| /unidades/ | unidades.dc.html | Unidades Salão Morenos em Serra, ES |
| /unidades/cidade-continental/ | cidade-continental.dc.html | Salão Morenos Cidade Continental \| Serra, ES |
| /unidades/novo-horizonte-av-brasil/ | novo-horizonte-av-brasil.dc.html | Salão Morenos Novo Horizonte — Av. Brasil \| Serra |
| /unidades/novo-horizonte-av-industrial/ | novo-horizonte-av-industrial.dc.html | Salão Morenos Novo Horizonte — Av. Industrial \| Serra |
| /servicos/ | servicos.dc.html | Serviços \| Salão Morenos em Serra |
| /servicos/corte-masculino/ | corte-masculino.dc.html | Corte Masculino em Serra \| Salão Morenos |
| /servicos/barboterapia/ | barboterapia.dc.html | Barboterapia em Serra \| Salão Morenos |
| /visagismo/ | visagismo.dc.html | Visagismo Masculino em Serra \| Salão Morenos |
| /dia-do-noivo/ | dia-do-noivo.dc.html | Dia do Noivo em Serra \| Salão Morenos |
| /o-clube/ | o-clube.dc.html | Clube Salão Morenos \| Planos e Assinatura |
| /cultura/ | cultura.dc.html | Sobre a Morenos \| Salão Morenos em Serra |
| /corporativo/ | corporativo.dc.html | Corporativo \| Salão Morenos em Serra |
| /trabalhe-conosco/ | trabalhe-conosco.dc.html | Trabalhe Conosco \| Salão Morenos |
| /politica-de-privacidade/ | politica-de-privacidade.dc.html | Política de Privacidade \| Salão Morenos |
| /termos-de-uso/ | termos-de-uso.dc.html | Termos de Uso \| Salão Morenos |
| 404 | 404.dc.html | Página não encontrada (status HTTP 404, noindex) |

Meta description, canonical, Open Graph e imagem OG de cada página estão no `<helmet>` de cada arquivo. Sitemap e robots prontos em `prototipo/seo/`. Links internos do protótipo (`*.dc.html`) → trocar pelos `paths`.

## Componentes
- **SiteHeader** (`SiteHeader.dc.html`): sticky, fundo rgba(11,11,11,.94) + blur 8px, borda inferior rgba(246,244,239,.1). Logo 54–82px de altura (clamp). Desktop (≥1120px): Unidades ▾, Serviços ▾ (mega menu), O Clube, Sobre a Morenos; botões "Ver planos" (/o-clube/#planos) e "Agendar". Mobile (<1120): "Agendar" + hambúrguer 44×44, menu em acordeão. Mega menu: entra com dropIn .34s cubic-bezier(.22,1,.36,1), sai com dropOut .3s antes de desmontar. Item ativo da seção atual em #B79A6A. Esc fecha tudo.
- **Modal "Escolha sua unidade"** (dentro do header): abre por qualquer CTA "Agendar/Escolher unidade" (evento global `morenos:agendar`, `detail.unit` opcional). Bottom sheet #171717, borda superior 2px #B79A6A, raio 24px 24px 0 0, max 620px. Lista as 3 unidades; ao escolher, grava localStorage e mostra "Agendar nesta unidade" (Cashbarber, nova aba) + "Conhecer a unidade". Rodapé: "Agendar como visitante pelo WhatsApp".
- **SiteFooter**: card com raio superior 24–42px, borda rgba(246,244,239,.14), brilho radial dourado no topo. Colunas Morenos / Serviços / Unidades / Clube, link de WhatsApp. Sem redes sociais (não confirmadas).
- **PaginaMorenos** (`PaginaMorenos.dc.html`): renderizador das 13 páginas internas a partir de uma lista de seções por página (todo o conteúdo e a copy final estão na função `paginas()`). Tipos de seção:
  - `hero` — com `hero-wide.webp`: tela cheia (min-height clamp(560px,82vh,820px), gradiente escuro). Com fotos menores: **hero dividido** (texto à esquerda, foto em quadro raio 32px à direita, máx. 520px para retrato 4/5, 640px para paisagem 3/2) para não ampliar as fotos além da resolução original. Inclui breadcrumb (`<nav><ol>`, `aria-current`).
  - `info` (grade de dados da unidade), `unidades` (painéis fotográficos 3 colunas, raio 28px, botões Conhecer / Agendar / Como chegar), `texto` (editorial claro/escuro com foto), `passos` (etapas numeradas), `destaques` (cards fotográficos de serviço), `catalogo` (lista por categoria com duração), `planos` (abas de filtro + cards brancos com "Assinar"), `ofertas` (corporativo), `galeria`, `mapa` (iframe Google Maps + "Abrir no Google Maps"), `form`, `faq` (acordeão), `cta` (CTA final com as 3 unidades + WhatsApp).
- **Home** (`Home.dc.html`): composição própria (hero com foto em tela cheia, unidades com mapa expansível no hover, serviços em mosaico, Experiência, Clube com mockup de celular e inclinação 3D no mouse, depoimentos em colunas com rolagem vertical, galeria com lightbox, Sobre, FAQ em abas, CTA final).

## Tela de abertura — `prototipo/site-loader.js`
Componente global (no framework: `SiteLoader`), carregado no `<head>` antes de tudo (com `html,body{background:#080908}` inline e preload da logo) para cobrir a página desde o primeiro quadro. Injetado só por JS: sem JS o site aparece normal. Configuração em `site-config.js → C.loader`: `showOncePerSession` (hoje `false` = aparece em toda carga de página; `true` = só na primeira da sessão, chave sessionStorage `morenos_intro_seen`), `minimumVisibleTime: 1200`, `maximumVisibleTime: 4500`, `exitDuration: 560`, `logo: assets/morenos-loader-outline-white.webp` (720×669, traço fino, transparente).
Visual (baseado no componente de preloader enviado pelo cliente, nas cores da Morenos): fundo radial #181917→#0B0C0B→#050605; a logo é usada como **máscara CSS** de três camadas — base rgba(246,244,239,.24), brilho diagonal contínuo (linear-gradient 45deg transparente → #FFFFFF → #B79A6A → transparente, background-size 300%, 2.2s linear infinito) e preenchimento branco que acende quando a página fica pronta. Entrada da logo: opacity 0→1, scale .86→1, translateY 14px→0, blur 6px→0 (.95s, cubic-bezier(.22,.61,.36,1)). Halo bronze sutil pulsando atrás. Fundo carvão uniforme radial #111211→#0A0B0A→#060706 com vinheta escura nas bordas (sem halo). Logo 140–200px desktop, 120–160px mobile. Durante a espera a logo cresce devagar até scale 1.08 (3.2s, cubic-bezier(.33,0,.2,1)). Saída: brilho pausa e logo preenche de branco (.38s), depois a logo encolhe da escala atual até .82 com fade (.42s, cubic-bezier(.55,0,.25,1)) e o overlay faz só fade de opacity (.56s, atraso .1s). Performance: sem overflow:hidden (a rolagem é travada por wheel/touchmove/teclas, sem reflow), overlay com will-change:opacity e contain:strict, troca de classe em duplo requestAnimationFrame, <style> do loader não é removido.
Espera real com `Promise.allSettled`: DOMContentLoaded, logo carregada, `document.fonts.ready`, decode da `main img[fetchpriority=high]` do hero (não espera window.load nem imagens lazy). Mínimo 1200ms, máximo 4500ms + rede de segurança. Ao sair remove nó e CSS, restaura rolagem (compensa a barra), `aria-busy` false no `<main>`, evento `morenos:intro-end`, entrada curta do hero. `prefers-reduced-motion`: logo branca estática, fade de 250ms. Testar de novo: `?intro` na URL. z-index 2147483000. Sem bibliotecas.

## Rolagem suave — `prototipo/smooth-scroll.js`
Inércia estilo Lenis sem dependência (lerp 0.095 por frame no wheel), só com mouse/trackpad (`hover: hover and pointer: fine`); toque, teclado e barra de rolagem nativos; desligada em reduced-motion; ignora wheel dentro de modais, iframes e áreas roláveis. Âncoras da mesma página rolam suave descontando a altura do header. No Code, pode virar Lenis se o projeto já usar, ou manter este script.

## Animações
- Revelação ao rolar em todas as páginas internas (`data-rv`): opacity 0→1 + translateY(32px)→0, 900ms, cubic-bezier(.22,1,.36,1), escalonado 90ms entre irmãos (máx. 5). Só aplica em elementos fora da tela no carregamento.
- Modais (agendar, lightbox): entrada .45–.6s, saída .34–.38s antes de desmontar.
- Hero dividido: zoom de entrada da foto scale 1.08→1 em 1.6s.

## Seções adicionadas automaticamente nas páginas internas
Faixa da marca em marquee (CORTE · BARBA · ESTILO · ROTINA · MORENOS · SERRA, 42s) logo após o hero; avaliações em colunas com rolagem vertical (3 avaliações reais do Google) antes do FAQ em Unidades, unidades, Corte, Barboterapia, Visagismo e Sobre; banner do Clube (card escuro com grade, "CLUBE" em gradiente prata, "Ver planos" + "Assinar") antes do CTA final em Serviços, serviços, unidades e Sobre; destaques de serviço em mosaico 6 colunas (4/2/3/3) no desktop; galeria com lightbox.

## Dados estruturados
Cada página tem BreadcrumbList JSON-LD; as 3 páginas de unidade têm HairSalon com nome, endereço, URL e imagem. Telefone e horário ficam fora até confirmação.

## Páginas legais
Política de Privacidade (LGPD: dados dos formulários, localStorage/sessionStorage, analytics, terceiros Cashbarber/WhatsApp/Google Maps/Google Fonts, bases legais, direitos do art. 18, retenção) e Termos de Uso. Linkadas no rodapé e no aviso dos formulários. **Antes de publicar:** preencher razão social, CNPJ, endereço e e-mail do encarregado (comentários TODO) e passar por revisão jurídica.

## Formulários (Dia do Noivo, Corporativo, Trabalhe Conosco)
Sem backend: validam no envio (campos obrigatórios; telefone com ≥10 dígitos), mostram erro sob o campo (`role="alert"`, borda #A3361F) e focam o primeiro inválido. Se válido: monta `contactFlows.<tipo> + "\n\n" + "Rótulo: valor"` por linha, dispara o evento de lead e abre o WhatsApp em nova aba. Feedback: "Vamos abrir o WhatsApp com suas informações." + link de reserva. **Nunca exibir "enviado com sucesso".** Campos exatos em `paginas()`.

## Design tokens
Cores: preto #0B0B0B · carvão #141414 / #171717 · grafite #242424 · branco quente #F6F4EF · cinza claro #E8E5DF · branco #FFFFFF · bronze #B79A6A (labels, linhas, hover; em fundo claro usar #8A6F3E para contraste) · textos de apoio #D6D3CC, #C5C2BB, #A9A69F, #7C7975 (escuro) e #5F5C57 (claro) · erro #A3361F.
Tipografia: Poppins 400/500/600/700. H1 clamp(40px,6.2vw,82px) (dividido: clamp(38px,4.8vw,70px)), lh .98, ls -.035em. H2 clamp(32px,4.2vw,54px), lh 1.02, ls -.03em. Label 11–12px, 700, ls .26–.3em, maiúsculas. Corpo 16–19px, lh 1.6–1.7.
Raios: 100px (botões pílula) · 14px (inputs) · 16–20px (itens) · 24–28px (cards/painéis) · 32px (foto do hero).
Botões: pílula com borda metálica animada (padding 1.5px, linear-gradient 100deg, background-size 200%, keyframe `metal` 7s linear infinite). Primário: miolo gradiente #FFFFFF→#E8E5DF, texto #0B0B0B 700. Secundário: miolo #202020→#000, texto #E8E5DF 600. 13px, ls .14em, maiúsculas, min-height 50px. Hover: brightness + translateY(-2px), .45–.5s cubic-bezier(.22,1,.36,1).
Container: max-width 1480px, padding lateral clamp(16px,3vw,36px). Seções: padding vertical clamp(56px,7vw,104px).
Movimento: transições de 0,35–0,6s com cubic-bezier(.22,1,.36,1); respeitar `prefers-reduced-motion` (desligar animações).

## Acessibilidade / mobile
Alvos ≥44px; foco visível (outline 2px #B79A6A, offset 3px); link "Pular para o conteúdo"; um H1 por página; labels persistentes; sem rolagem horizontal; header sticky com "Agendar" sempre visível.

## Assets (`prototipo/img/`, WebP)
hero-wide (1672×941, única com resolução para tela cheia) · foto-atendimento, foto-atendimento-2, foto-barba, foto-crianca, foto-salao (720×900) · foto-corte, foto-visagismo (800×1000) · unidade-cidade-continental (1000×667, fachada identificada) · unidade-av-brasil (1000×1000), unidade-av-industrial (750×1000) — **não confirmado** a qual unidade pertencem; usar como imagem institucional · logo (320×320). Todas vieram do site antigo do cliente. Gerar srcset/AVIF no build. Pedir originais em alta (≥2000px) ao cliente.

## SEO técnico a implementar
Pré-renderização de todas as rotas · metadata por rota · canonical · OG · breadcrumbs (e BreadcrumbList JSON-LD) · LocalBusiness/HairSalon JSON-LD por unidade só com dados confirmados (a Home tem um rascunho) · sitemap · robots por ambiente · 404 real · redirects 301 se alguma URL antiga mudar.

## Arquivos
`prototipo/` — 14 páginas + 404, componentes, `support.js` (runtime do protótipo, não migrar), `site-config.js`, `site-loader.js`, `smooth-scroll.js`, `assets/` (logo do loader), `img/`, `seo/`, `MIGRATION-CHECKLIST.md` (pendências com o cliente e lista do que não foi migrado do site antigo).
