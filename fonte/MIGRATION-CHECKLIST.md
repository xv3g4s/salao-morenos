# Salão Morenos — checklist de migração

Dados centralizados em `site-config.js`. Itens migrados do site antigo estão marcados com `source: "legacy-site"` e `needsConfirmation: true`. Para achar tudo: buscar `needsConfirmation` e `TODO`.

## Confirmar com o cliente

- [ ] telefones por unidade
- [ ] WhatsApp definitivo (hoje: +55 27 99871-3993, do site antigo)
- [ ] horários por unidade (hoje: seg–sex 08:00–20:00, sáb 09:00–18:00, iguais para as três; domingo não informado)
- [ ] número do imóvel em Cidade Continental (Avenida Terceiro Mundo)
- [ ] número do imóvel na Avenida Brasil
- [ ] agendamento Cidade Continental (hoje: agenda geral Cashbarber)
- [ ] agendamento Av. Brasil (hoje: agenda geral Cashbarber)
- [ ] agendamento Av. Industrial (hoje: agenda geral Cashbarber)
- [ ] Google Business Cidade Continental (hoje: busca no Google Maps pelo endereço)
- [ ] Google Business Av. Brasil
- [ ] Google Business Av. Industrial
- [ ] planos atuais (7 planos migrados, sem duplicados)
- [ ] preços atuais
- [ ] regras do Clube: periodicidade e agendamentos simultâneos (sem valor no site antigo, não publicados)
- [ ] Clube: sem taxa de adesão e sem fidelidade (publicado)
- [ ] Clube: uso em qualquer unidade (publicado)
- [ ] Clube: cartão de crédito recorrente (publicado)
- [ ] Clube: assinatura presencial (publicado)
- [ ] Clube: eventos, parcerias e cashback (não publicados)
- [ ] serviços por unidade
- [ ] duração dos serviços (Corte Kids sem duração)
- [ ] equipe por unidade (página de unidade sem seção de equipe até confirmar)
- [ ] avaliações do Google por unidade (páginas de unidade sem avaliações até confirmar)
- [ ] fotos por unidade (só a fachada de Cidade Continental tem identificação)
- [ ] corporativo: Business Essential, Premium, Unlimited, Eventos
- [ ] Dia do Noivo: unidade, itens e formato
- [ ] história da empresa (página Sobre sem ano, fundador ou números)
- [ ] Instagram oficial
- [ ] Facebook oficial
- [ ] CNPJ para o rodapé
- [ ] Política de Privacidade e Termos: razão social, CNPJ, endereço da sede e e-mail do encarregado (DPO); revisão jurídica antes de publicar

## Não migrado (conteúdo legado inconsistente)

Vitória como localização, John Six, Curitiba, Ecoville, telefones DDD 41, "maior barbearia", "quase 2.000 membros", "primeira barbearia por assinatura", Sala VIP, espumante, fotógrafo, massagem, bebidas premium, pacotes antigos do Dia do Noivo, descrição antiga do Corte Masculino Premium.

## Produção (Claude Code)

- [ ] pré-renderizar as páginas (o protótipo monta o conteúdo no navegador; robôs que não executam JS veem os marcadores `{{ }}`)
- [ ] rotas finais: ver `C.paths` em `site-config.js`; o `sitemap.xml` e **gerado**
      pelo build de producao (`fonte/build.py`), nao e arquivo escrito a mao
- [ ] `robots.txt` tambem e gerado pelo build, um por ambiente: producao declara
      o `Sitemap:` do dominio final, homologacao libera o rastreio e nao declara sitemap
- [ ] o `noindex` de homologacao e escrito no `<head>` pelo build e repetido no
      `X-Robots-Tag` do `.htaccess` — **nao** depende de JavaScript. `C.env.stage`
      em `site-config.js` so marca o ambiente para o analytics
- [ ] 404 servido com status HTTP 404 (`404.dc.html`)
- [ ] GTM/GA4: preencher `C.analytics`; eventos já disparam em `window.dataLayer`
- [ ] JSON-LD LocalBusiness por unidade só com dados confirmados
- [ ] srcset/AVIF das imagens
- [ ] redirects do WordPress antigo (as 9 URLs atuais foram mantidas)


---

## Avaliações do Google (integração Places API)

Adicionado depois do handoff — ver `GOOGLE-REVIEWS-INTEGRATION.md` na raiz.

- [ ] Google Cloud: projeto, faturamento e **Places API (New)** ativos
- [ ] API Key exclusiva do servidor, restrita à Places API (New) e ao IP da conta
- [ ] `GOOGLE_MAPS_API_KEY` configurada em `~/.morenos-env.php` (fora do public_html)
- [ ] Place ID das três unidades validado pelo endereço (`npm run find:google-places`)
- [ ] **Política de Privacidade**: acrescentar que a seção de depoimentos exibe
      conteúdo público do Google Maps (texto, nome e foto de perfil dos autores),
      carregado por requisição feita pelo servidor do site
- [ ] **Termos de Uso**: revisar junto, na mesma passagem jurídica que já estava
      pendente (razão social, CNPJ, encarregado)

---

## Revisão de arquitetura de conteúdo (out/2026)

O que mudou está em `fonte/ARQUITETURA.md`. O que **depende do cliente** para
sair do jeito que está hoje:

### Bloqueia texto que já está no ar

- [ ] **Links de agendamento por unidade.** Os três `bookingUrl` são `null` e
      caem na agenda geral do Cashbarber. Por isso o site não diz mais "cada
      unidade tem a própria agenda". Com os três links, a frase volta e o
      botão "Agendar nesta unidade" passa a levar à agenda daquele endereço.
- [ ] **Fotos das unidades.** Só a fachada de Cidade Continental está
      identificada (`fotoConfirmada: true`). As outras duas páginas e os
      cartões usam foto de atendimento, sem afirmar o lugar. Com a foto real
      de cada endereço: trocar `foto`/`fotoAlt` e marcar `fotoConfirmada: true`
      em `C.locations` (`site-config.js`) — nada mais precisa mudar.
- [ ] **Telefone por unidade.** A pergunta "os telefones estão publicados?",
      que respondia "ainda não, entram quando o cliente confirmar", saiu do
      FAQ: era recado interno na cara do visitante. O site mostra só o
      WhatsApp geral. Com os telefones, eles entram em `C.locations`.
- [ ] **Avaliações.** A Home mostra três avaliações reais, copiadas do perfil
      do Google na montagem do design. Confirmar que podem continuar
      publicadas e de qual unidade é cada uma — ou ligar a integração da
      Places API (`GOOGLE-REVIEWS-INTEGRATION.md`), que busca as avaliações na
      fonte e identifica a unidade sozinha.

### Conteúdo que falta para a página ficar completa

- [ ] **Serviços por unidade.** Hoje o site diz "confira a disponibilidade na
      agenda". Com a lista por unidade, cada página de unidade mostra o que
      tem ali.
- [ ] **Preços dos serviços avulsos.** Só os planos do Clube têm valor
      publicado. O FAQ de `/servicos/` diz que o preço aparece na agenda.
- [ ] **Regras do Clube**: periodicidade e agendamentos simultâneos continuam
      sem valor confirmado e, por isso, fora da página.
- [ ] **Equipe, estrutura, estacionamento e acessibilidade**: nada publicado,
      porque nada foi informado. São o tipo de informação que decide a visita —
      vale perguntar.
- [ ] **Trabalhe Conosco**: a página agora diz, no FAQ, que não anuncia vaga e
      que o envio vai pelo WhatsApp. Se existir vaga aberta, o texto muda.
- [ ] **Dia do Noivo**: a unidade do atendimento é combinada no WhatsApp. Se
      houver unidade fixa ou pacote com itens definidos, entra na página.

### Decisões tomadas sem o cliente (reverter é barato)

- O FAQ saiu da Home e as perguntas foram para `/unidades/`, `/servicos/` e
  `/o-clube/`, onde cada uma é respondida.
- O bloco `#sobre` da Home saiu; o link para `/cultura/` ficou no bloco da
  Experiência Morenos.
- A galeria saiu das páginas de unidade, de `/visagismo/` e de
  `/dia-do-noivo/`: eram as mesmas quatro fotos, sem relação com a página.
- O banner do Clube ficou só em `/servicos/`, `/servicos/corte-masculino/` e
  `/servicos/barboterapia/`.

---

## Revisão de SEO (out/2026) — o que depende do cliente

O que foi implementado está no relatório e em `fonte/MIGRACAO.md`. Aqui fica só
o que **nenhum ajuste de código resolve**: informação que a Morenos tem e o
site não.

### Por unidade

**Cidade Continental — Avenida Terceiro Mundo**
- [ ] **Número do imóvel** (hoje a página publica a avenida sem número, e a
      rota do Google Maps vai sem número também).
- [ ] Complemento, se houver (loja, sala).
- [ ] Telefone próprio, se existir — ou confirmar que o WhatsApp é central.
- [ ] Horário próprio — ou confirmar que é igual ao das outras duas.
- [ ] Link do Perfil da Empresa no Google (`g.page/...` ou "Compartilhar").
- [ ] Link de agendamento próprio no Cashbarber, se existir.
- [ ] Lista dos serviços que esta unidade faz.
- [ ] Fotos: a fachada já está identificada; faltam fotos do interior.

**Novo Horizonte — Avenida Brasil**
- [ ] **Número do imóvel** (mesma situação da Cidade Continental).
- [ ] Complemento, se houver.
- [ ] Telefone próprio, se existir.
- [ ] Horário próprio — ou confirmar que é igual.
- [ ] Link do Perfil da Empresa no Google.
- [ ] Link de agendamento próprio no Cashbarber.
- [ ] Lista dos serviços desta unidade.
- [ ] **Fotos identificadas**: hoje a página usa foto de atendimento, não a
      fachada — ninguém confirmou que a foto de fachada do acervo é deste
      endereço, e um cartão com o nome da avenida sobre uma fachada afirma que
      aquele prédio é aquele lugar.

**Novo Horizonte — Avenida Industrial, 830 — Loja 3**
- [ ] Confirmar número e loja (é a única com número no site).
- [ ] Telefone próprio, se existir.
- [ ] Horário próprio — ou confirmar que é igual.
- [ ] Link do Perfil da Empresa no Google.
- [ ] Link de agendamento próprio no Cashbarber.
- [ ] Lista dos serviços desta unidade.
- [ ] **Fotos identificadas** (mesma situação da Av. Brasil).

### Para o site todo

- [ ] **Grafia do nome.** O site escreve "Salão Morenos"; a fachada da foto
      mostra "Salão Moreno's". Qual é a razão social e qual é o nome de
      fachada? Os dois precisam bater com o Perfil da Empresa, senão o Google
      trata como negócios diferentes.
- [ ] **Preço dos serviços avulsos.** Hoje só o Clube tem valor publicado.
- [ ] **Duração do Corte Kids** (é o único item do catálogo sem duração, sob
      um texto que diz "durações aproximadas").
- [ ] **Regras do Clube**: periodicidade e agendamentos simultâneos continuam
      sem valor confirmado e, por isso, fora da página.
- [ ] **História e equipe** para a página Sobre (`/cultura/`): ano de início,
      quem fundou, quantos profissionais. Sem isso, a página fica curta — e
      curta e verdadeira é melhor que longa e inventada.
- [ ] **Estacionamento, acessibilidade, estrutura**: nada publicado porque
      nada foi informado. É o tipo de informação que decide a visita.
- [ ] **Procedência dos três depoimentos** publicados na Home (vieram do perfil
      do Google na montagem do design): confirmar que podem continuar no ar e
      de qual unidade é cada um — ou ligar a integração da Places API.
- [ ] **Razão social, CNPJ, endereço da sede e e-mail do encarregado (DPO)**
      para a Política de Privacidade e os Termos (revisão jurídica).
- [ ] **Instagram e Facebook oficiais** (hoje o site não publica nenhum perfil;
      sem eles, o `sameAs` do JSON-LD fica de fora).
- [ ] **Autorização de uso de imagem** das pessoas que aparecem nas fotos e nos
      dois clipes enviados em out/2026 (rosto identificável, publicação no site).
- [ ] **Reenviar `IMG_2019.HEIC` em JPEG**: o arquivo veio corrompido e nenhum
      conversor abre.
- [ ] **Vaga aberta?** A página Trabalhe Conosco hoje diz, no FAQ, que não
      anuncia vaga e que o envio segue pelo WhatsApp. Se houver vaga, muda.

### Só na publicação definitiva

- [ ] Auditar os sitemaps do WordPress antigo (posts, categorias, ElementsKit)
      com `npm run auditar:site-antigo https://salaomorenos.com.br` — este
      ambiente de desenvolvimento não alcança o domínio do cliente.
- [ ] Decidir, no CSV que o script gera, o destino de cada URL antiga que não
      tem equivalente. **Não redirecionar tudo para a home.**
- [ ] Verificar a propriedade no Search Console e enviar o sitemap definitivo.
- [ ] Apontar o campo "site" de cada Perfil da Empresa para a página da unidade.
- [ ] Desligar ou redirecionar o subdomínio de aprovação.
