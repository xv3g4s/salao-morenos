# Search Console — Salão Morenos

Playbook do projeto. Estado em 2026-10-22.

Situação de hoje, em uma tabela:

| Coisa | Como está agora |
|---|---|
| Site novo (17 rotas, estático) | Em homologação, em `https://novosite.salaomorenos.com.br` |
| Indexação da homologação | `noindex` no `<head>` **e** no cabeçalho HTTP `X-Robots-Tag` |
| `robots.txt` da homologação | Libera o rastreio de propósito, **sem** linha `Sitemap:` |
| `sitemap.xml` da homologação | **Não existe.** O build apaga o arquivo (`fonte/build.py:676-680`) |
| `salaomorenos.com.br` | Ainda serve o site antigo (WordPress) |
| `public/` commitado no repositório | **É o build de HOMOLOGAÇÃO**, com `noindex` nas 16 rotas e o bloco `X-Robots-Tag` no `.htaccess` (conferido: `public/.htaccess:1-6`) |
| Propriedade no Search Console | Recém-verificada, nome exibido: `salaomorenos.com.br` |
| Aba Sitemaps | Vazia, 0 enviados, com a caixa **Adicionar um novo sitemap** (*Add a new sitemap*) aberta |

**Limite deste documento.** O ambiente de desenvolvimento não alcança `salaomorenos.com.br` pela rede (o proxy bloqueia o domínio) e também não alcança `support.google.com` nem `developers.google.com`. Então: nada aqui afirma o que está no ar hoje no domínio do cliente, e a redação exata das telas e das páginas de ajuda do Google precisa ser conferida no navegador antes de executar. Onde o levantamento não encontrou página oficial, está escrito **sem fonte oficial**.

**Duas regras que valem para o documento inteiro:** nenhuma posição no Google é prometida, e nenhum prazo de indexação é prometido. O Google diz que rastrear as URLs de um sitemap pode levar de dias a semanas e que não há garantia de que todas sejam rastreadas ou indexadas — não existe número além disso.

---

## 0. Antes de qualquer clique: descubra o tipo da propriedade

Quase toda decisão abaixo muda conforme o tipo. Isso é leitura, não altera nada.

1. Abra o seletor de propriedades (canto superior esquerdo).
2. Olhe como o nome aparece:

| O que aparece | Tipo | O que cobre |
|---|---|---|
| `salaomorenos.com.br` (sem protocolo, sem barra) | **Domínio** | `http` e `https`, com e sem `www`, **e todos os subdomínios — inclusive `novosite.salaomorenos.com.br`** |
| `https://salaomorenos.com.br/` (com protocolo e barra) | **Prefixo de URL** | Só esse protocolo e esse host, e todos os caminhos abaixo dele. Não cobre `http://`, não cobre `www.`, não cobre subdomínio |

3. Confirme também em **Configurações › Verificação da propriedade** (*Settings › Ownership verification*) **qual método** verificou a propriedade. Isso importa mais do que parece — ver o passo 2.4.

Por que isso é decisivo aqui:

- Se for **Domínio**, a propriedade engloba o ambiente de homologação. A caixa de sitemap vai **aceitar** uma URL em `novosite.salaomorenos.com.br` sem reclamar. O único motivo pelo qual isso não acontece hoje é que a homologação não tem sitemap nenhum.
- Se for **Prefixo de URL**, a homologação está fora da propriedade: não dá para inspecionar URL de lá, e um sitemap de lá seria recusado.

Fontes: tipos de propriedade — `support.google.com/webmasters/answer/10431861` e `.../34592`; identificador na API (`sc-domain:salaomorenos.com.br` vs `https://salaomorenos.com.br/`) — `developers.google.com/webmaster-tools/v1/sites`. Nenhuma dessas páginas pôde ser aberta deste ambiente.

Não apague nem recrie a propriedade para "acertar o tipo". Se faltar cobertura, **adicione** outra propriedade ao lado. Apagar derruba o histórico daquela propriedade.

---

## 1. O que dá para fazer agora

### 1.1 Feche a caixa "Adicionar um novo sitemap" sem enviar nada

Este é o item mais importante da etapa. Aba Sitemaps vazia **é o estado correto hoje**, não é pendência.

**Por que não enviar o sitemap do site novo:**

1. Ele não existe em lugar nenhum que o Google possa buscar. Em homologação o build apaga `public/sitemap.xml` de propósito (comentário no próprio código: *"em homologacao nao ha sitemap para ninguem enviar ao Search Console por engano"*), e a trava de verificação do build recusa o build se o arquivo existir (`fonte/build.py:1112-1113`). Conferido: `/home/user/morenos-seo/public/sitemap.xml` não existe no disco.
2. `https://salaomorenos.com.br/sitemap.xml` não é o sitemap do site novo. Esse domínio ainda serve o WordPress antigo. O que responde ali hoje não foi verificado por nós.
3. Enviar o sitemap provisório como definitivo é regra explícita do cliente — não fazer.

**O que acontece se enviar mesmo assim:**

| Cenário | Resultado |
|---|---|
| `https://salaomorenos.com.br/sitemap.xml` responde 404 | O relatório registra **"Não foi possível buscar"** (*Couldn't fetch*). O Google tenta por alguns dias e para. Depois disso é preciso corrigir e **reenviar**: não se recupera sozinho |
| O WordPress serve um sitemap nesse caminho (ou redireciona para `/sitemap_index.xml`, `/wp-sitemap.xml`) | O envio dá certo — e você acabou de declarar formalmente o **mapa do site antigo** como o sitemap enviado da propriedade, às vésperas de substituí-lo. Posts, categorias, tags, anexos e páginas do ElementsKit entram na fila de rastreio |
| URL de `novosite.salaomorenos.com.br` numa propriedade de **Domínio** | Aceito sem aviso. Você estaria pedindo rastreio de 16 URLs que estão com `noindex` no HTML e no cabeçalho HTTP |
| URL de `novosite...` numa propriedade de **Prefixo de URL** | Recusado (URL fora da propriedade) |

E não dá para desfazer de verdade. Remover um sitemap **tira a linha do relatório**, mas, nas palavras da própria documentação, o Google *"não vai esquecer o sitemap nem nenhuma das URLs listadas nele"*. Para o Google parar de visitar aquelas URLs é preciso regra no `robots.txt`, tirar as páginas do ar ou `noindex` — remover do painel não faz isso. (`support.google.com/webmasters/answer/7451001`)

### 1.2 Não use a Inspeção de URL para "testar a infra nova"

A Inspeção de URL (*URL Inspection*) busca a URL a partir da infraestrutura do Google, pelo DNS público. Não existe campo de IP nem de host alternativo. Hoje, inspecionar `https://salaomorenos.com.br/` bate no **WordPress antigo** — exatamente o que não interessa testar.

- Se a propriedade for de **Domínio**, dá para inspecionar uma URL de homologação. O resultado esperado e **correto** é *Indexação permitida? Não — "noindex" detectado*. Isso é a prova de que o `noindex` funciona. Não "conserte".
- Atenção à armadilha inversa: se uma página estivesse bloqueada no `robots.txt`, a inspeção não conseguiria ler o `noindex` — o diagnóstico correto nesse caso vem do relatório **Indexação › Páginas**, não desse campo.
- Validação da infra nova antes da virada se faz de uma máquina com acesso, com `curl -I --resolve` ou override no `/etc/hosts` — não pelo Search Console.

### 1.3 Não use "Mudança de endereço"

**Configurações › Mudança de endereço** (*Change of Address*) serve para mover de um domínio ou subdomínio para outro. Aqui o domínio não muda: trocar WordPress por site estático no mesmo `salaomorenos.com.br` **não é mudança de endereço**. Abrir a solicitação só adiciona ruído. (`support.google.com/webmasters/answer/9370220`)

### 1.4 Não use "Remoções" para esconder a homologação

A remoção temporária (*Temporarily remove URL*) bloqueia a exibição por cerca de 6 meses, **não tira a página do índice e não impede o rastreio**. Quando expira, a URL pode voltar. O que mantém a homologação fora do índice é o `noindex` rastreável que já está no ar. Pior: numa propriedade de **Domínio**, a opção "Remover todas as URLs com este prefixo" aplicada na raiz tira o site inteiro dos resultados por ~6 meses — inclusive produção.

### 1.5 O que **vale** fazer agora

| Ação | Onde | Por quê |
|---|---|---|
| Identificar tipo e método de verificação | Configurações › Verificação da propriedade | Decide tudo o que vem depois (passo 0 e 2.4) |
| **Abrir a aba Remoções e ver se já existe alguma remoção ativa ou pendente** | Indexação › Remoções | Uma remoção por prefixo pedida por agência anterior bloqueia exibição por ~6 meses, **sobrevive calada à virada** e some do radar. Olhar as três abas (Remoções temporárias, Conteúdo desatualizado, Filtragem SafeSearch) e registrar o que houver. Não criar nada aqui |
| Conferir **Ações manuais** e **Problemas de segurança** | Segurança e ações manuais | Ação manual não resolvida impede o Google de ler sitemaps. É dado do site **antigo**, e é bom saber antes da virada |
| Conferir quem são os proprietários e apagar tokens não usados | Configurações › Usuários e permissões | Remover um proprietário **não** revoga o token dele; sem apagar o token, agência ou dev anterior se reverifica sozinho. O recurso de apagar token de propriedade não usado existe na tela (**sem fonte oficial** conferível daqui para a data de lançamento — conferir no painel) |
| **Adicionar a agência como proprietário**, enquanto o WordPress ainda está no ar | Configurações › Usuários e permissões | Ver 6.1. Se a verificação cair na virada e a agência não tiver acesso, ninguém consegue reverificar |
| Exportar o que houver de histórico | Desempenho › Resultados da pesquisa › **Exportar** | Ver seção 2 |
| Rodar o inventário do WordPress antigo | Terminal, de uma máquina com acesso | Ver seção 2 |
| Nada na aba Sitemaps | — | Ver 1.1 |

Sobre histórico: a coleta de dados começa quando a propriedade é **adicionada**, e **não há preenchimento retroativo**. Propriedade criada agora pode mostrar gráfico vazio por alguns dias, e isso é normal — não é erro de verificação, e não é base para afirmar nada sobre desempenho ao cliente. Os 16 meses são o teto de retenção, não um histórico que vem de brinde. (`support.google.com/webmasters/answer/7576553`)

---

## 2. Antes de trocar o site

Tudo nesta seção é sobre capturar o que some depois. Nada aqui publica nada.

### 2.1 Inventariar o WordPress antigo (o item mais urgente)

O mapa de URLs do projeto cobre **nove** rotas do site antigo. O WordPress publica mais que isso: posts, categorias, tags, anexos de mídia e as páginas geradas pelo ElementsKit. Nada disso foi levantado, porque este ambiente não alcança o domínio — e a decisão registrada no projeto é que *inventar a lista seria pior que não ter*.

De uma máquina que alcance o domínio:

```
node fonte/scripts/auditar-site-antigo.mjs https://salaomorenos.com.br
# ou
npm run auditar:site-antigo https://salaomorenos.com.br
```

O script lê `/robots.txt`, segue cada sitemap declarado (inclusive filhos de um índice), abre cada URL e escreve um CSV com status, redirecionamento, title, description, canonical e meta robots, sugerindo `MANTEM` / `REDIRECIONA` / `DECIDIR`.

Registre no mesmo passo, manualmente, o que o script não cobre:

- O que responde hoje em `https://salaomorenos.com.br/sitemap.xml`, `/sitemap_index.xml` e `/wp-sitemap.xml` (status HTTP e conteúdo).
- O conteúdo atual de `https://salaomorenos.com.br/robots.txt`.

Esse levantamento morre no instante em que o WordPress sai do ar. Depois dele, não há como reconstruir a lista.

### 2.2 Decidir no CSV o destino de cada linha "DECIDIR"

Regras já decididas no projeto:

| Caso | Destino |
|---|---|
| Post ou página com conteúdo útil que vira página nova | 301 da URL antiga para a nova |
| Conteúdo útil sem página nova própria | 301 para a página mais próxima do assunto |
| Sem destino próximo | Deixar responder 404 honesto |
| Categoria, tag, arquivo por data | 404 ou 410 |
| Mídia antiga ainda usada em outro lugar | Ver o aviso abaixo: **preservar não acontece sozinho** |
| Qualquer coisa | **Nunca** redirecionar tudo para a home — redirecionamento em massa para a raiz é tratado como página não encontrada e joga o histórico fora |

**Aviso sobre mídia antiga — leia antes de escrever "preservar" em qualquer linha do CSV.** A publicação roda (`.cpanel.yml`):

```
rsync -a --delete --exclude=".well-known/" --exclude="cgi-bin/" --exclude=".htpasswd" public/ "$DEPLOYPATH"
```

O `--delete` poupa exatamente três coisas: `.well-known/`, `cgi-bin/` e `.htpasswd`. **Todo o resto de `public_html` desaparece no momento da publicação, `wp-content/uploads` inclusive.** "Preservar no mesmo caminho" só é verdade se o arquivo estiver dentro de `public/` no repositório. Então, para cada linha "preservar":

1. Baixar o arquivo do servidor antigo.
2. Copiar para `/home/user/morenos-seo/public/` **no mesmo caminho** (ex.: `public/wp-content/uploads/2023/05/foto.jpg`).
3. Fazer isso **antes** do build e **commitar** junto com o resto (Passo 1 e Passo 3 do capítulo 3).

Sem esses três passos, a instrução "preservar" produz exatamente a perda silenciosa que ela adverte. Se o arquivo não vale o peso no repositório, a decisão honesta é 301 para o substituto — não "preservar".

**Esclarecimento que costuma virar erro:** o mapa diz "as nove rotas do site antigo são preservadas com o mesmo endereço, sem redirecionamento", e o roteiro do dia da virada manda "aplicar os 301". Não é contradição. As **nove** rotas (`/`, `/unidades/`, `/servicos/`, `/visagismo/`, `/dia-do-noivo/`, `/o-clube/`, `/cultura/`, `/corporativo/`, `/trabalhe-conosco/`) continuam no mesmo endereço e **não** recebem redirecionamento. Os 301 valem para o resto do WordPress, levantado no CSV.

### 2.3 Exportar o que existir de Search Console

| O que | Onde | Observação |
|---|---|---|
| Desempenho, período máximo | Desempenho › Resultados da pesquisa › **Exportar** (CSV / Sheets / Excel) | O export da interface vem **truncado em 1.000 linhas** de exemplos; os totais do relatório continuam refletindo a base completa |
| Indexação › Páginas (motivos de exclusão) | Relatório › Exportar | A janela de dados desse relatório é menor que a de Desempenho (**sem fonte oficial** para o número exato — exportar cedo e não contar com histórico longo) |
| Links (externos, internos, texto âncora) | Links › Exportar | Lista usada depois para cruzar com o CSV de 404 |

Para volume maior do que o export da tela aguenta, há dois caminhos oficiais, os dois fora do escopo desta etapa e ambos com pré-requisito:

- **Search Analytics API** — teto de 50.000 linhas por dia por site por tipo de pesquisa.
- **Exportação em massa para o BigQuery** (Configurações › Exportação em massa de dados) — só proprietário configura, exige projeto Google Cloud com faturamento ativo, **não preenche o passado** (só exporta do dia em que for ligada em diante) e o BigQuery cobra armazenamento e consulta.

Se a propriedade foi criada agora, pode simplesmente não haver nada para exportar. Nesse caso, registre isso por escrito em vez de inventar uma linha de base.

### 2.4 Garantir que a verificação sobrevive à virada

Este é o risco silencioso da migração.

| Método que verificou a propriedade | Sobrevive à troca do site? |
|---|---|
| Registro TXT no DNS | **Sim.** O registro mora na zona DNS, não no servidor |
| Arquivo HTML na raiz (`googleXXXX.html`) | **Não.** E não é passivo: o `rsync --delete` da publicação **apaga ativamente** o arquivo de `public_html`, porque ele não existe dentro de `public/` |
| Meta tag no `<head>` | **Não.** O build novo não emite nenhuma `google-site-verification` |
| Google Analytics | **Não.** O build novo não carrega GA |
| Google Tag Manager | **Não.** O build novo não carrega GTM |

Conferido no repositório: não há `google-site-verification`, GA nem GTM no build (`C.analytics = { gtmId: null, ga4Id: null }`). Se a verificação de hoje estiver ancorada em qualquer um dos quatro métodos "de site", ela cai no momento exato em que o site novo substituir o WordPress — e o acesso ao painel se perde justamente quando ele é mais necessário.

Procedimento:

1. Abra **Configurações › Verificação da propriedade** e anote tipo e método.
2. Se não for DNS, peça ao cliente a inclusão de um registro **TXT** de verificação **agora**, enquanto o WordPress ainda está no ar.
3. O TXT entra na zona **autoritativa** do domínio — ou seja, onde apontam os nameservers. Pode ser Registro.br, a hospedagem, Cloudflare ou outro. Descubra antes (`dig NS salaomorenos.com.br +short`); editar do lado errado não surte efeito nenhum. **Sem fonte oficial** para o passo a passo do Zone Editor do cPanel e para a tela atual do Registro.br — conferir no painel.
4. O registro é **adicionado** ao lado dos TXT que já existem no apex (SPF, verificações de outros serviços), nunca substituindo. Sobrescrever o TXT do apex derruba o e-mail do cliente.
5. **Não remova o registro depois que verificar.** O Google reconfere periodicamente; se o token sumir, a propriedade perde a verificação e as permissões expiram após um período de carência (o Google não publica a duração — **não prometa prazo**).
6. Inclua "TXT de verificação preservado" na checagem da migração, caso haja troca de DNS ou de hospedagem.

**Saída de emergência, se o TXT não ficar pronto a tempo da virada:** commitar o arquivo `googleXXXX.html` dentro de `/home/user/morenos-seo/public/`, na raiz. O bloco de proteção do `.htaccess` (`public/.htaccess:133-135`) nega `.htaccess`, `.gitignore`, `.cpanel.yml`, `package.json`, `*.md|py|mjs|csv|yml|yaml` e `.env*` — **não** nega `.html`, então o arquivo continua sendo servido. É muleta: o TXT no DNS continua sendo o objetivo, porque é o único que sobrevive a uma troca de hospedagem.

Observação: verificar a propriedade de Domínio por DNS também verifica automaticamente propriedades de prefixo de URL criadas depois sob o mesmo domínio (`confiança secundária` — conferir na tela). Mas verificação automática não traz dados: uma propriedade criada depois começa sem histórico.

### 2.5 Procurar a propriedade antiga

Se havia agência ou desenvolvedor anterior, provavelmente existe uma propriedade do Search Console do WordPress, com histórico. Peça ao cliente. Se existir, ela é a linha de base de verdade — e os tokens de proprietário de quem saiu devem ser apagados em **Configurações › Usuários e permissões**.

Ao abrir essa propriedade, **olhe a aba Sitemaps dela antes de qualquer outra coisa** e anote o que estiver enviado (`/sitemap.xml`, `/sitemap_index.xml`, `/wp-sitemap.xml`, sitemaps de plugin). Qualquer sitemap submetido ali vai para **"Não foi possível buscar"** no instante em que o WordPress sair do ar. Isso é consequência esperada da virada, não defeito. Registre por escrito agora, para que ninguém entre em pânico depois — ou, pior, tente "consertar" republicando o mapa do site antigo. Confira também a aba **Remoções** dessa propriedade, pela mesma razão do item 1.5.

---

## 3. No dia da troca

Ordem exata. O Search Console é o **passo 8**, quase o último. Não antecipe.

### Passo 0 — Critério de aborto e plano de volta (definir ANTES de começar)

A partir do Passo 5 o WordPress deixa de existir no servidor: o `rsync --delete` não guarda cópia. O backup do Passo 4 é o único caminho de volta. Nada começa sem estas quatro linhas preenchidas e combinadas com o cliente:

| Item | Preencher antes |
|---|---|
| **Quem restaura** | Nome e telefone de quem tem acesso ao cPanel/backup e vai executar a volta |
| **Como se restaura** | Comando ou caminho exato (restaurar o backup de arquivos no document root + importar o dump do banco). Testar o caminho de restauração **antes**, de preferência numa conta de teste |
| **Quanto tempo leva** | Medir na preparação, não estimar na hora. É esse número que decide se dá para tentar consertar ou se restaura direto |
| **O que caracteriza aborto** | Qualquer um destes, confirmado no Passo 6: home não responde 200; mais de uma das 16 rotas respondendo erro; `noindex` no HTML ou em `X-Robots-Tag` em produção; `robots.txt` com `Disallow: /`; canonical apontando para `novosite.` |

Regra: se o critério de aborto bater, **restaura primeiro, investiga depois**. Não se depura em produção com o site fora do ar. Dois itens que **não** são motivo de aborto: 404 em URL antiga ainda não mapeada (corrige-se com 301 no passo seguinte) e gráfico vazio no Search Console.

Janela: combinar horário de baixo movimento e ter pelo menos uma pessoa conferindo no ar, ao vivo, do Passo 6 ao Passo 7.

### Passo 1 — Preparar o conteúdo de `public/`

Tudo que precisa estar no ar tem que estar dentro de `/home/user/morenos-seo/public/` **antes** do build, porque a publicação espelha essa pasta e apaga o resto.

- [ ] Mídia antiga marcada como "preservar" no CSV, copiada para `public/` no mesmo caminho (ver 2.2).
- [ ] Os **301 do CSV escritos em `/home/user/morenos-seo/public/.htaccess`** — o arquivo versionado (`git ls-files public/.htaccess` confirma). Nunca no `public_html/.htaccess` do servidor: o deploy seguinte apaga, sem aviso, e semanas depois ninguém associa a causa.
- [ ] Se a verificação do Search Console depender de arquivo HTML, o `googleXXXX.html` na raiz de `public/` (ver 2.4).

Onde escrever os 301 dentro do arquivo: abaixo do bloco de HTTPS/`www` canônico e acima das regras de cache, usando `RewriteRule ... [R=301,L]` ou `RedirectMatch 301`. O build **não** mexe nessas linhas: `ajusta_htaccess` (`fonte/build.py:793-808`) só liga e desliga o bloco delimitado por `# >>> homologacao ... # <<< homologacao <<<`.

### Passo 2 — Build de produção e conferência local

```
python3 fonte/build.py
npm run check            # equivale a: node fonte/checar.mjs public
npm run test:seo         # node fonte/testes/seo.mjs public
npm run test:arquitetura # node fonte/testes/arquitetura.mjs public
npm run test:grades      # node fonte/testes/grades.mjs public
```

**O argumento `public` não é opcional em `checar.mjs`.** `fonte/checar.mjs:24` é `path.resolve(process.argv[2] || '.')` — o padrão é a **raiz do repositório**, não `public/`. Rodado sem argumento, o verificador serve a raiz (que não tem `index.html`) e reporta todas as rotas faltando: alarme falso no exato portão em que a pessoa está com pressa. Os irmãos `arquitetura.mjs`, `grades.mjs` e `seo.mjs` têm `|| 'public'` como padrão, então a inconsistência é invisível para quem copia por analogia. Use os scripts do `package.json` acima e o problema não aparece.

Depois confira **no disco**, antes de publicar:

- [ ] Nenhuma página com `noindex`, exceto `404.html` (que é `noindex` de propósito nos dois ambientes).
- [ ] `public/.htaccess` **sem** o bloco de homologação (`Header set X-Robots-Tag "noindex, nofollow"` entre os marcadores `# >>> homologacao`).
- [ ] `public/robots.txt` com `Allow: /` **e** com a linha `Sitemap: https://salaomorenos.com.br/sitemap.xml`.
- [ ] `public/sitemap.xml` existe, com **16 URLs**, todas em `https://salaomorenos.com.br`.
- [ ] Canonical absoluto e autorreferente, apontando para o domínio final.
- [ ] Os 301 do Passo 1 estão no arquivo (o build não os remove, mas confirme que o build não foi rodado a partir de uma cópia antiga).

**O que a trava do build pega, e o que ela não pega.** `confere_indexacao` (`fonte/build.py:1064-1118`) recusa o build se houver `noindex` em produção, canonical ausente/duplicado/errado, `Disallow: /` no robots, falta da linha `Sitemap:` em produção, bloco de homologação no `.htaccess` de produção, sitemap ausente, sitemap com URL de outro domínio ou apontando para arquivo que não existe em disco. Ela **não** faz duas coisas da lista acima:

- **Não conta as 16 URLs.** Essa checagem vive em `fonte/testes/seo.mjs:144` (`checa(locs.length === ROTAS.length, ...)`) — por isso `npm run test:seo` não é opcional.
- **Não confere `Allow: /`.** A trava só rejeita `Disallow: /` (`fonte/build.py:1086-1087`). O `Allow: /` é conferência de olho, na lista acima.

Não ignore os avisos de nenhum dos dois.

### Passo 3 — Commitar o `public/` de produção

**O passo que mais dá errado, e o único que nenhuma trava pega.** O `.cpanel.yml` diz na própria linha: *"o que vai para o ar e o public/ que estiver commitado"*. Rodar o build na máquina local e disparar o deploy sem commitar publica o `public/` **anterior** — que hoje é o build de **homologação**, com `noindex` nas 16 rotas e o `X-Robots-Tag` no `.htaccess`. É exatamente a catástrofe que `confere_indexacao` existe para impedir, e a única que ela não enxerga: ela confere o disco local, não o que foi commitado.

```
git status                      # tem que listar as mudancas de public/
git add -A public/
git commit -m "build de producao para a virada"
git push                        # para o branch que o deploy do cPanel observa
git status                      # tem que sair limpo: "nothing to commit"
```

- [ ] `git status` limpo depois do push.
- [ ] `git show --stat HEAD` mostra `public/robots.txt`, `public/sitemap.xml`, `public/.htaccess` e as 16 rotas.
- [ ] `git show HEAD:public/.htaccess | head -10` **não** traz o bloco `# >>> homologacao`.
- [ ] `git show HEAD:public/robots.txt` traz a linha `Sitemap:`.

Conferir o conteúdo **commitado**, não o do disco, é o ponto inteiro deste passo.

### Passo 4 — Backup do WordPress

Arquivos e banco. Antes de qualquer coisa tocar o document root. Guardar fora do servidor. Anotar onde ficou e conferir com o Passo 0: é este backup que o plano de volta usa.

### Passo 5 — Reconciliar o document root e publicar

Antes de disparar: o `.cpanel.yml` fixa `export DEPLOYPATH=$HOME/public_html/`. Isso é **um único alvo de deploy**.

**Pergunta que precisa de resposta antes do primeiro deploy:** homologação (`novosite.salaomorenos.com.br`) e produção (`salaomorenos.com.br`) estão na **mesma conta cPanel**?

| Resposta | Consequência |
|---|---|
| Contas (ou usuários cPanel) diferentes | Caso simples: cada uma tem seu `$HOME/public_html/`. Seguir o roteiro como está |
| Mesma conta, subdomínio em pasta (`$HOME/novosite/` ou `$HOME/public_html/novosite/`) | `$HOME/public_html/` é o docroot de **produção**. O deploy do repositório publica em produção, não no subdomínio — e quem vinha publicando a homologação fazia isso por outro caminho. Mapear esse caminho **antes**, porque é ele que o Passo 10 vai precisar desligar |
| Mesma conta, e o subdomínio aponta para `$HOME/public_html/` | Os dois ambientes compartilham o mesmo docroot. Nesse caso não existe "publicar em produção sem publicar na homologação": o Passo 5 e o Passo 10 viram um passo só, e o roteiro precisa ser redesenhado com o cliente antes do dia da virada |

Confirmado o alvo, publicar: site novo no document root de `salaomorenos.com.br`.

### Passo 6 — Conferir no domínio final, na hora

- [ ] Home responde 200.
- [ ] Cada uma das 16 rotas responde 200.
- [ ] Uma URL inventada (`/pagina-que-nao-existe/`) responde **404**, não 200. Página que diz "não encontrado" devolvendo 200 vira **soft 404** no relatório.
- [ ] `view-source:` de três páginas: sem `noindex`, com um canonical só, absoluto e autorreferente.
- [ ] `curl -I` numa página qualquer: **sem** `X-Robots-Tag: noindex` no cabeçalho. São duas fontes independentes de `noindex` — conferir as duas.
- [ ] `https://salaomorenos.com.br/robots.txt` abre e traz a linha `Sitemap:`.
- [ ] `https://salaomorenos.com.br/sitemap.xml` abre e lista as 16 URLs do domínio final.
- [ ] **As formas não canônicas de pelo menos uma das nove rotas preservadas**, com `curl -I`. O `.htaccess` novo traz `DirectorySlash On` e um 301 de `/pasta/index.html` → `/pasta/` que o WordPress não tinha:

```
curl -I https://salaomorenos.com.br/servicos             # 301 -> /servicos/
curl -I https://salaomorenos.com.br/servicos/index.html  # 301 -> /servicos/
curl -I https://www.salaomorenos.com.br/servicos/        # 301 -> sem www
curl -I http://salaomorenos.com.br/servicos/             # 301 -> https
```

Cada um precisa chegar a `https://salaomorenos.com.br/servicos/` e responder 200 ali. O que se procura aqui é salto empilhado: `http` → `https` → sem `www` → com barra em quatro saltos quando um só bastaria.

Se qualquer item do critério de aborto do Passo 0 bater, pare e restaure.

### Passo 7 — Conferir os 301 do CSV

Os redirecionamentos já foram publicados junto com o site (Passo 1 + Passo 3). Aqui se testa **cada um** com `curl -I`:

- Precisa responder **301** (ou 308), não 302/303/307. Temporário não carrega o sinal de canônico, e o Google pode manter a URL antiga como canônica.
- **Um salto só**, direto ao destino final. O Googlebot segue cerca de 10 saltos antes de desistir, mas cada salto é latência e risco de cadeia quebrada — encadear é dívida, não orçamento a gastar. (O limite prático que a agência usa — "no máximo 3" — é **sem fonte oficial**; o que é oficial é o "um salto só, direto ao destino".)
- Conferir os saltos que se empilham sem ninguém notar: `http → https`, `www → sem www`, barra final (ver Passo 6).
- Nenhum 301 nas nove rotas preservadas.
- Se o DevTools do Chrome mostrar um "307 Internal Redirect" no salto `http → https`, isso é artefato de HSTS do próprio navegador. Valide com `curl -I`, que não faz HSTS.

Se faltar algum 301, ele é corrigido em `/home/user/morenos-seo/public/.htaccess`, commitado e publicado de novo — **nunca** editado direto no servidor. Edição direta no `public_html/.htaccess` é apagada pelo `rsync --delete` da publicação seguinte.

Manter os redirecionamentos no ar **pelo menos 1 ano**, que é o prazo da orientação oficial de mudança de site, e mais tempo enquanto ainda houver acesso chegando pelas URLs antigas. Na dúvida, mantenha.

### Passo 8 — Search Console

Só agora, e só depois que os passos 6 e 7 estiverem confirmados no ar.

1. Confirme que a propriedade continua verificada (ver 2.4). Se caiu, reverifique **antes** de seguir.
2. Abra **Sitemaps** (*Indexação › Sitemaps*).
3. Na caixa **Adicionar um novo sitemap** (*Add a new sitemap*), digite `sitemap.xml` e clique em **Enviar** (*Submit*). Um envio só.
4. Não envie nada do subdomínio de homologação.
5. Opcional: **Inspeção de URL** + **Solicitar indexação** (*Request indexing*) em **no máximo 3 rotas** (home e as duas páginas mais importantes), **uma vez só, e nunca mais**. Repetir o pedido na mesma URL **não acelera** o rastreio e queima a cota diária da propriedade — o número exato da cota não é publicado pelo Google (**sem fonte oficial** para "X URLs por dia"). Para volume, o caminho oficial é o sitemap. Se a dúvida for "será que peço mais uma?", a resposta é não (ver 5.12).

Nota: enviar o sitemap pelo painel é **redundante com a descoberta** — o `robots.txt` de produção já declara `Sitemap: https://salaomorenos.com.br/sitemap.xml`, e o Google encontra o arquivo sozinho. Vale enviar mesmo assim porque o relatório Sitemaps só exibe o que foi enviado por ele ou pela API: é ali que ficam a data de acesso do Googlebot e os erros de processamento. Sitemap descoberto só pelo `robots.txt` não aparece na aba.

### Passo 9 — Fora do Search Console, no mesmo dia

- Apontar o campo **Site** de cada Perfil da Empresa para a página **daquela unidade**, não para a home. (Boa prática da agência — **sem fonte oficial** do Google determinando isso. O que é oficial: um link por domínio por perfil, a página precisa ser válida e acessível, e os rastreadores de verificação de link do Perfil **não seguem `robots.txt`** — ou seja, jamais colocar ali a URL de homologação.)
- Link de agendamento vai no campo de **link de ação**, não no campo de site.
- Conferir endereço, telefone e horário batendo letra por letra com o site.
- Conferir se link externo (Instagram, WhatsApp, Cashbarber, parceiros) aponta para URL antiga que mudou.

### Passo 10 — Desligar a homologação

Não deixar o subdomínio no ar com o mesmo conteúdo depois da virada. Preferência: 301 página a página para o domínio principal. Alternativa: desativar. Nunca duas cópias competindo.

**Quem edita o `.htaccess` do subdomínio, e o que mais sai junto.** A partir do Passo 3 o repositório passa a carregar o build de **produção**: ninguém mais vai publicar homologação a partir dele, e `ajusta_htaccess` só mexe na cópia do repositório, não no servidor. O docroot do subdomínio continua servindo, indefinidamente, o último conteúdo publicado nele — HTML com `noindex` e `.htaccess` com o bloco `X-Robots-Tag`.

Então, na pessoa que tem acesso ao servidor (não pelo deploy do repositório):

1. Localizar o docroot do subdomínio (ver a tabela do Passo 5).
2. Editar o `.htaccess` dali: **remover o bloco** entre `# >>> homologacao: inserido pelo build, nao editar a mao >>>` e `# <<< homologacao <<<`, e **na mesma edição** acrescentar o 301 página a página para `https://salaomorenos.com.br`. Os dois juntos: um redirecionamento 301 cuja resposta ainda carrega `X-Robots-Tag: noindex` manda sinal contraditório sobre o destino.
3. `curl -I https://novosite.salaomorenos.com.br/servicos/` → precisa dar **301** para `https://salaomorenos.com.br/servicos/`, **sem** `X-Robots-Tag` na resposta.
4. Se a opção for desativar o subdomínio em vez de redirecionar, nada disso é necessário — mas aí o subdomínio tem que parar de responder de verdade, não servir página de hospedagem com status 200.
5. Registrar quem fez e quando, porque esse `.htaccess` não está sob controle de versão.

---

## 4. Primeiros 30 dias

### Frequência

| Período | Frequência | Foco |
|---|---|---|
| Dias 1 a 14 | Diária, 5 minutos | Sitemaps, Indexação › Páginas, Inspeção de URL nas rotas antigas |
| Dias 15 a 30 | Semanal | Mesmos relatórios, mais Desempenho |
| Depois | Mensal, mais uma conferida a cada alteração estrutural | — |

**Não confie no e-mail como alarme.** O Search Console avisa por e-mail em parte dos casos (ação manual, problema de segurança, alguns alertas de indexação), só para proprietário verificado com notificação ligada, e só depois de rerastrear. Não geram e-mail: queda de cliques, canonical errado, sitemap parado em "Não foi possível buscar", redirecionamento quebrado.

### O que olhar

| Relatório | O que conferir |
|---|---|
| **Sitemaps** | Status do envio e data da última leitura. *Êxito* significa que o **arquivo** foi buscado e lido sem erro — **não** significa indexado. "Páginas descobertas" é só a contagem de URLs lidas do arquivo |
| **Indexação › Páginas** | O que está indexado, o que foi excluído e por quê |
| **Inspeção de URL** | Testar as URLs antigas que receberam 301: o destino precisa ser o esperado e canônico. Lembre que o teste ao vivo **segue o redirecionamento** antes de testar — para validar o 301 em si, use `curl -I` |
| **Desempenho** | Comparar as páginas que recebiam visita antes e depois. O relatório tem alguns dias de atraso; o Google não publica o número (**sem fonte oficial**) — não leia gráfico de ontem como se fosse de hoje |
| **Segurança e ações manuais** | Antes de culpar o sitemap por qualquer erro de leitura |
| **HTTPS** | Páginas que não estão sendo servidas em HTTPS — pega link ou asset que ficou em `http` |

Busca `site:novosite.salaomorenos.com.br` no Google, uma vez por semana: nenhuma URL do subdomínio deve aparecer.

### Normal — não mexa

| Sinal | Por que é normal |
|---|---|
| "Excluída por tag noindex" nos arquivos `*.dc.html` em `/_dc/` | Comportamento desejado: o `.htaccess` aplica `X-Robots-Tag: noindex, nofollow` neles de propósito (`public/.htaccess:112-114`). Eles **não** podem ser bloqueados por `Require all denied`, senão o site aparece vazio |
| "Excluída por tag noindex" na página 404 | É `noindex` de propósito nos dois ambientes |
| "Página com redirecionamento" nas URLs antigas do WordPress que receberam 301 | Estado esperado: URL que redireciona não é indexada, só o destino é |
| "Rastreada – no momento não indexada" nas primeiras semanas | A documentação diz que a página pode ser indexada depois e que **não é preciso reenviar** a URL |
| "Descoberta – no momento não indexada" | O Google encontrou e reagendou o rastreio. Mexer no conteúdo da página não é a alavanca |
| URLs do sitemap **sem** `lastmod` | O `lastmod` vem do último commit git que tocou a rota; sem histórico, a rota sai sem a tag, por decisão ("melhor nenhum do que inventado") |
| As cinco pastas de assets respondendo **403** em vez de 404 | Decisão registrada do projeto (`fonte/AUDITORIA-SEO.md:78`), sem efeito de busca |
| Sitemap da **propriedade antiga** em "Não foi possível buscar" | Consequência esperada da virada: o WordPress saiu do ar. Ver 2.5. Não republicar o mapa antigo para "consertar" |
| Core Web Vitals vazio | Dado de campo do CrUX, percentil 75, janela rolante de 28 dias. Site local de baixo volume pode simplesmente não ter dados — não é erro de implementação. Validar uma correção custa mais 28 dias de monitoramento |
| Gráfico de Desempenho vazio nos primeiros dias | A coleta começa na adição da propriedade, sem preenchimento retroativo |
| Flutuação nas primeiras semanas | Queda nas primeiras semanas é comum numa troca de site. Isso **não** é promessa de recuperação em prazo nenhum |

### Alarme — investigue hoje

| Sinal | O que provavelmente é |
|---|---|
| "Excluída por tag noindex" em **rotas de produção** | Publicou-se o `public/` de homologação (Passo 3 pulado), ou sobrou `noindex` no `<head>`, ou sobrou o bloco no `.htaccess`. Conferir as **duas** fontes, e conferir o que está **commitado** |
| "Bloqueada pelo robots.txt" em qualquer rota de produção | `robots.txt` errado publicado. Nesse estado o Google **não lê nenhum `noindex`** |
| Sitemap em "Não foi possível buscar" por mais de algumas horas | Arquivo ausente, URL errada, ou ação manual não resolvida. Para erro temporário a documentação diz que **não** é preciso reenviar; só reenvie se persistir |
| **Soft 404** | Página dizendo "não existe" com status 200. Corrigir devolvendo 404/410 de verdade |
| Pico de 404 em URLs antigas que tinham acesso | Cruzar com o CSV da seção 2.1: há redirecionamento que ninguém previu |
| **301 que funcionava e parou de funcionar** | Alguém escreveu a regra direto no `public_html/.htaccess` do servidor e o deploy seguinte apagou. Reescrever em `public/.htaccess` e commitar (Passo 1 e Passo 7) |
| **Imagem antiga respondendo 404** | O `rsync --delete` levou `wp-content/uploads`. Só volta pelo backup do Passo 4 — ver 2.2 |
| Canonical apontando para `novosite.salaomorenos.com.br` | Build errado publicado |
| URL do subdomínio aparecendo em `site:novosite.salaomorenos.com.br` | O `noindex` caiu, ou o subdomínio ficou no ar sem o bloco de homologação (Passo 10) |
| Propriedade "não verificada" | O token caiu junto com o WordPress (ver 2.4). Reverificar |
| Ação manual ou problema de segurança | Corrigir **todas** as páginas afetadas e pedir revisão |

---

## 5. Armadilhas

### 5.1 Enviar o sitemap agora, com a caixa aberta

- **O que a pessoa faria:** digitar `sitemap.xml` e clicar em **Enviar**, porque a aba está vazia e parece pendência.
- **O que acontece:** ou "Não foi possível buscar" registrado no painel (o Google tenta alguns dias e desiste), ou o envio do **sitemap do site antigo** como sitemap oficial da propriedade.
- **Em vez disso:** fechar a caixa. Enviar só no passo 8 do dia da virada.

### 5.2 Achar que remover o sitemap desfaz o envio

- **O que a pessoa faria:** enviar "só para testar", confiando em remover depois.
- **O que acontece:** remover tira do relatório; o Google não esquece o sitemap nem as URLs listadas nele.
- **Em vez disso:** tratar o envio como ação que não se desfaz.

### 5.3 Usar `Disallow: /` junto com o `noindex` na homologação

- **O que a pessoa faria:** "trancar" o ambiente de aprovação no `robots.txt`.
- **O que acontece:** o robô não rastreia, nunca lê o `noindex`, e a URL ainda pode aparecer na busca a partir de links externos — só o endereço, sem descrição. Na Inspeção de URL, o campo de indexação deixa de refletir o `noindex`, escondendo o problema.
- **Em vez disso:** manter como está. O `robots.txt` da homologação libera o rastreio **de propósito**. O build tem trava que recusa `Disallow: /` (`fonte/build.py:1086-1087`).

### 5.4 Escrever `Noindex:` dentro do `robots.txt`

- **O que a pessoa faria:** adicionar a linha achando que bloqueia.
- **O que acontece:** nada. O Google deixou de honrar essa regra em 1º de setembro de 2019.
- **Em vez disso:** meta robots no `<head>` ou cabeçalho `X-Robots-Tag` — que é o que o build já faz.

### 5.5 Trocar o `noindex` por canonical apontando para produção

- **O que a pessoa faria:** tirar o `noindex` da homologação e deixar só o canonical.
- **O que acontece:** canonical é dica de consolidação, não diretiva de bloqueio. A URL de homologação continua elegível para indexação.
- **Em vez disso:** `noindex` rastreável. Em homologação o canonical aponta para o próprio subdomínio de propósito — apontar para o domínio final seria mandar o robô para uma URL que ainda não existe lá.

### 5.6 Confundir o tipo da propriedade

- **O que a pessoa faria:** supor que `salaomorenos.com.br` cobre tudo (ou que não cobre nada).
- **O que acontece:** com prefixo de URL, metade dos dados some sem mensagem de erro e a pessoa conclui que "o site não tem tráfego". Com propriedade de Domínio, a homologação entra nos relatórios e a caixa de sitemap aceita URL do subdomínio sem avisar.
- **Em vez disso:** passo 0, antes de qualquer clique.

### 5.7 Criar uma propriedade por unidade

- **O que a pessoa faria:** três propriedades, uma por loja, esperando ver ligações e rotas.
- **O que acontece:** três propriedades para manter, todas começando sem histórico, e **zero** dado de Maps. O filtro de tipo de pesquisa do Desempenho tem Web, Imagem, Vídeo e Notícias — não existe "Maps". Visualização de perfil, pedido de rota e clique em ligar só existem no Perfil da Empresa.
- **Em vez disso:** uma propriedade e filtro por **Página** no Desempenho. O recorte por unidade de verdade vem do Perfil da Empresa.

### 5.8 Apagar o registro TXT "porque já verificou"

- **O que a pessoa faria:** limpar a zona DNS depois da verificação passar.
- **O que acontece:** o Google reconfere; o token some, a propriedade perde a verificação e levam junto relatórios, permissões e sitemaps enviados.
- **Em vez disso:** deixar o registro para sempre, e preservá-lo em qualquer troca de DNS ou hospedagem.

### 5.9 Remover o proprietário antigo sem apagar o token dele

- **O que a pessoa faria:** tirar a agência anterior da lista de usuários.
- **O que acontece:** o token de verificação continua válido e a pessoa pode se reverificar sozinha, com acesso total.
- **Em vez disso:** apagar também o **token de propriedade não usado** em Configurações › Usuários e permissões.

### 5.10 Usar "Mudança de endereço" nesta migração

- **O que a pessoa faria:** abrir a solicitação achando que "avisa o Google" da troca.
- **O que acontece:** a ferramenta só vale para troca de domínio ou subdomínio em propriedade de nível de host. Aqui o domínio não muda: ou não deixa submeter, ou não faz nada — e o time fica com a falsa sensação de que avisou, pulando a parte que importa, que são os 301.
- **Em vez disso:** 301 no servidor e sitemap atualizado.

### 5.11 Usar "Remoções" para tirar a homologação do Google

- **O que a pessoa faria:** pedir remoção do subdomínio.
- **O que acontece:** bloqueio de exibição por ~6 meses, sem tirar do índice e sem impedir rastreio. Quando expira, volta. Numa propriedade de Domínio, remoção por prefixo na raiz derruba produção junto. A correspondência é exata, inclusive maiúsculas e minúsculas.
- **Em vez disso:** `noindex` rastreável; e, depois da virada, 301 do subdomínio para o domínio principal ou desativação. E, antes de tudo, olhar se **já existe** remoção pendente deixada por outra pessoa (item 1.5).

### 5.12 Clicar "Solicitar indexação" em série

- **O que a pessoa faria:** pedir indexação das 16 URLs, e repetir todo dia enquanto aparecer "Rastreada – no momento não indexada".
- **O que acontece:** não acelera nada — a documentação diz isso explicitamente — e queima a cota diária da propriedade.
- **Em vez disso:** sitemap enviado e rastreio normal. No dia da virada, no máximo 3 URLs, uma vez só (Passo 8, item 5).

### 5.13 Tentar a Indexing API

- **O que a pessoa faria:** usar a Indexing API para forçar as 16 URLs.
- **O que acontece:** ela só aceita páginas com `JobPosting` ou `BroadcastEvent` dentro de `VideoObject`. Não é ferramenta de indexação em massa.
- **Em vez disso:** sitemap.

### 5.14 Programar um "ping" de sitemap no deploy

- **O que a pessoa faria:** chamar a URL de ping do Google a cada publicação.
- **O que acontece:** nada. O endpoint foi descontinuado (anúncio de 26/06/2023) e hoje responde 404. Não quebra nada, só cria a ilusão de que o deploy avisa o Google.
- **Em vez disso:** linha `Sitemap:` no `robots.txt` (já existe em produção) e envio pelo Search Console.

### 5.15 Procurar o controle de taxa de rastreamento

- **O que a pessoa faria:** abrir Configurações atrás do slider de crawl rate e concluir que falta permissão.
- **O que acontece:** a ferramenta foi desligada em 08/01/2024. A tela não existe.
- **Em vez disso:** nada. O ajuste é automático. A única alavanca oficial hoje é responder 500/503/429, o que afeta o hostname inteiro e atrasa a descoberta de páginas novas — exatamente o oposto do que se quer logo após uma virada.

### 5.16 Mexer no `priority` e no `changefreq`

- **O que a pessoa faria:** ajustar esses campos no `build.py` achando que ajudam, ou sair procurando onde removê-los.
- **O que acontece:** o Google ignora os dois — e o `build.py` **não gera** nenhum dos dois. O sitemap emite só `<loc>` e, quando existe, `<lastmod>`. Não há nada para remover, e mexer ali arrisca o `lastmod`, que o Google **usa**.
- **Em vez disso:** não tocar. (Cuidado com busca por "priority" no repositório: os resultados são os atributos `fetchpriority` das imagens, que são outra coisa.)

### 5.17 Carimbar `lastmod` com a data do build

- **O que a pessoa faria:** atualizar o `lastmod` das 16 URLs a cada deploy.
- **O que acontece:** o Google só usa `lastmod` se for consistente e verificavelmente preciso, e refletindo alteração relevante. Data inflada faz o sinal ser descartado.
- **Em vez disso:** manter como está — o `lastmod` vem do último commit git que tocou a rota, e a rota sai sem a tag quando não há histórico.

### 5.18 Ler "Êxito" como "indexado"

- **O que a pessoa faria:** reportar ao cliente que "já subiu no Google".
- **O que acontece:** *Êxito* diz apenas que o arquivo foi buscado e lido sem erro. Não fala nada sobre rastreio nem sobre indexação de nenhuma URL. "Páginas descobertas" também não é "páginas indexadas".
- **Em vez disso:** reportar a partir de **Indexação › Páginas**.

### 5.19 Prometer prazo

- **O que a pessoa faria:** dizer ao cliente "em X dias está indexado" ou "voltamos à posição anterior em Y semanas".
- **O que acontece:** cobrança em cima de um número que o Google nunca deu.
- **Em vez disso:** a documentação fala em "de alguns dias a algumas semanas" para rastrear as URLs de um sitemap, sem garantia de que todas sejam rastreadas ou indexadas. Nenhum número além disso tem fonte.

### 5.20 Rodar o build e disparar o deploy sem commitar

- **O que a pessoa faria:** `python3 fonte/build.py`, ver "indexacao conferida: producao" na tela, e clicar em publicar.
- **O que acontece:** vai para o ar o `public/` **commitado**, que hoje é o build de homologação — 16 rotas com `noindex` e `X-Robots-Tag: noindex, nofollow` no cabeçalho, no domínio principal. A trava `confere_indexacao` confere o **disco local**: ela aprovou o build que ninguém publicou. É a pior falha possível do projeto, e a única que nenhuma trava pega.
- **Em vez disso:** Passo 3. `git status` limpo e `git show HEAD:public/.htaccess | head -10` sem o bloco de homologação, antes de publicar.

### 5.21 Escrever o 301 direto no `.htaccess` do servidor

- **O que a pessoa faria:** entrar pelo File Manager ou SSH e acrescentar as linhas no `public_html/.htaccess`, porque é mais rápido.
- **O que acontece:** funciona — até a publicação seguinte. O `rsync -a --delete` sobrescreve o arquivo pelo de `public/`, sem aviso e sem log visível. Semanas depois, 404 em massa nas URLs antigas e ninguém associa à causa.
- **Em vez disso:** sempre em `/home/user/morenos-seo/public/.htaccess`, commitado. O único `.htaccess` editado no servidor é o do **subdomínio** de homologação (Passo 10), que não é alvo do deploy.

### 5.22 Escrever "preservar" no CSV e não copiar o arquivo

- **O que a pessoa faria:** marcar `MANTEM` nas imagens de `wp-content/uploads` e seguir em frente.
- **O que acontece:** o `rsync --delete` só poupa `.well-known/`, `cgi-bin/` e `.htpasswd`. Todo o `uploads` some no Passo 5, e só volta pelo backup.
- **Em vez disso:** copiar para dentro de `public/`, no mesmo caminho, antes do build (2.2 e Passo 1) — ou decidir pelo 301 e assumir.

---

## 6. O que depende do cliente

### 6.1 Bloqueia o Search Console

| Item | Por quê |
|---|---|
| Dizer **quem** é dono da conta Google que verificou `salaomorenos.com.br` | Enviar sitemap, configurar exportação e gerenciar usuários são ações de **proprietário**. "Usuário completo" não basta |
| **Adicionar a agência como proprietário, agora** (Configurações › Usuários e permissões › Adicionar usuário › Permissão: Proprietário) | Sem isso, se a verificação cair na virada (2.4) a agência não tem como reverificar, e o painel fica inacessível exatamente no dia em que é mais necessário. Fazer enquanto o WordPress ainda está no ar |
| Acesso à zona DNS autoritativa (ou alguém que publique o TXT) | Único método de verificação que sobrevive à troca de plataforma. Descobrir primeiro onde a zona está hospedada |
| Informar se existe propriedade antiga do Search Console (agência/dev anterior) | É onde está o histórico de verdade; é onde podem estar sitemaps e remoções pendentes (2.5); e os tokens de quem saiu precisam ser apagados |
| **Confirmar se homologação e produção estão na mesma conta cPanel** | O `.cpanel.yml` fixa um único `DEPLOYPATH`. Sem essa resposta, os Passos 5 e 10 não podem ser executados com segurança |
| **Quem executa o rollback, e teste do caminho de restauração** | Passo 0. Do Passo 5 em diante, o backup é o único caminho de volta |
| Autorização para publicar no domínio principal | Nada do capítulo 3 começa sem isso |
| Janela para a virada | Os passos 6 e 7 precisam de alguém conferindo no ar, na hora |

### 6.2 Precisa ser rodado de fora deste ambiente

Este ambiente não alcança `salaomorenos.com.br`. Dependem de uma máquina com acesso:

- O inventário do WordPress antigo (`auditar-site-antigo.mjs`) — seção 2.1.
- Download da mídia antiga marcada como "preservar" — seção 2.2.
- Qualquer `curl -I` de conferência de 301, de forma não canônica e de cabeçalho.
- Conferir o que responde hoje em `/robots.txt` e `/sitemap.xml`.
- Abrir as páginas de ajuda do Google citadas aqui e conferir a redação atual.

### 6.3 Perfis da Empresa (afeta o dia da virada)

- Confirmar que existe **um** perfil próprio por unidade, e só um. Perfil duplicado divide avaliação — nesse caso, pedir mesclagem, nunca criar outro.
- Reivindicar ou validar a propriedade de cada perfil, e dar acesso.
- Antes de qualquer edição: buscar os três endereços no Maps. Criar perfil por cima de um que já existe gera duplicata, com perda de avaliações e risco de suspensão.
- Link do perfil (`g.page`) de cada unidade, hoje `null` no `site-config.js`.
- Nome do perfil: não acrescentar palavra de busca. O nome precisa refletir a fachada real.

### 6.4 Dados do site que o Google e os perfis precisam ver batendo

Estes já bloqueiam texto publicado e, por tabela, a consistência entre site e Perfil da Empresa:

| Pendência | Situação |
|---|---|
| Grafia oficial do nome | O site escreve "Salão Morenos", a fachada mostra "Salão Moreno's", o `.htaccess` escreve "Salao Moreno's". Os três precisam bater com o Perfil, senão o Google trata como negócios diferentes |
| Número do imóvel de duas unidades | Cidade Continental / Av. Terceiro Mundo e Novo Horizonte / Av. Brasil estão sem número. A página publica a avenida sem número e a rota do Maps vai sem número. Av. Industrial, 830 — Loja 3 precisa de confirmação |
| Telefone e horário por unidade | Hoje o site publica um WhatsApp central e o mesmo horário para as três, ambos herdados do site antigo e não confirmados |
| Links de agendamento por unidade | Os três estão `null` e caem na agenda geral |
| Fotos identificadas das unidades | Só Cidade Continental tem foto confirmada; as outras duas recebem foto neutra |
| Instagram e Facebook oficiais | Sem eles o `sameAs` do JSON-LD fica de fora |
| Razão social, CNPJ, endereço da sede, e-mail do encarregado (DPO) e revisão jurídica | Política de Privacidade e Termos |
| Autorização de uso de imagem das pessoas nas fotos e nos dois clipes | E reenviar `IMG_2019.HEIC` em JPEG (o arquivo veio corrompido) |

### 6.5 Opcional, ainda desligado

Integração de avaliações do Google (Places API): projeto Google Cloud com faturamento e Places API (New) ativos, API Key exclusiva de servidor restrita por IP, `GOOGLE_MAPS_API_KEY` em `~/.morenos-env.php` fora do `public_html`, e Place ID das três unidades validado. Nasce desligada no build; só é publicada com `--avaliacoes-google`.

---

## Anexo — o que não foi verificado

O proxy deste ambiente bloqueia `support.google.com`, `developers.google.com` e `salaomorenos.com.br`. Todas as páginas oficiais citadas foram lidas por busca indexada, não por leitura direta. Antes de usar qualquer trecho como argumento escrito para o cliente, abra a URL no navegador e confira a redação atual — a interface e a lista de métodos de verificação do Search Console mudam.

Itens marcados **sem fonte oficial** neste documento:

- Número exato da cota diária de "Solicitar indexação" na interface.
- Prazo exato entre o envio do sitemap e a primeira leitura no relatório.
- Duração do período de carência depois que um token de verificação some.
- Prazo exato de atraso do relatório Desempenho (seção 4). "Alguns dias" é observação de uso, não número publicado.
- Janela de retenção do relatório Indexação › Páginas (seção 2.3). Sabe-se que é menor que a de Desempenho; o número não.
- Data de lançamento do recurso de apagar token de propriedade não usado (seção 1.5). O recurso existe na tela; o mês não pôde ser conferido daqui.
- Limite prático de 3 saltos numa cadeia de redirecionamento (Passo 7). É regra da agência. O que é oficial: o Googlebot segue cerca de 10 saltos, e a recomendação é um salto só, direto ao destino.
- Passo a passo atual do Zone Editor do cPanel e da zona DNS do Registro.br.
- Recomendação de apontar o campo "Site" de cada Perfil da Empresa para a página da unidade (é prática da agência).
- UTM no campo de site do Perfil da Empresa.
- Qualquer afirmação de que sitemap com URLs 404 cause rebaixamento ou penalidade. Isso é folclore até aparecer fonte.

Números que **têm** fonte e por isso não estão na lista acima: "de alguns dias a algumas semanas" para rastrear URLs de um sitemap; manter redirecionamentos por **pelo menos 1 ano** (orientação oficial de mudança de site); fim do `Noindex:` no `robots.txt` em 01/09/2019; descontinuação do ping de sitemap em 26/06/2023; desligamento do controle de taxa de rastreamento em 08/01/2024; teto de 50.000 linhas/dia da Search Analytics API; truncamento do export da interface em 1.000 linhas; 16 meses de retenção do Desempenho; ~6 meses da remoção temporária; janela de 28 dias do CrUX.

Documentos relacionados no repositório: `fonte/MIGRACAO.md` (roteiro do dia da virada e mapa de URLs), `fonte/MIGRATION-CHECKLIST.md` (pendências do cliente), `fonte/PERFIS-GOOGLE.md` (Perfis da Empresa), `fonte/AUDITORIA-SEO.md` (achados técnicos), `.cpanel.yml` (o que vai para o ar, e como).

Dois itens do `MIGRATION-CHECKLIST.md` estavam desatualizados e **foram corrigidos junto com este documento**, para o repositório não carregar duas versões da verdade:

- A linha dizia que `C.env.stage` aplicava `noindex,nofollow` sozinho em `novosite.*`. Não aplica: `stage` (`site-config.js:10`) é um teste de hostname que só marca o ambiente para o analytics. O `noindex` é escrito no `<head>` pelo build e repetido no `X-Robots-Tag` — justamente para não depender de JavaScript.
- As linhas apontavam para `seo/robots.txt`, `seo/robots-homologacao.txt` e `seo/sitemap.xml`. Esses arquivos não existem mais (`fonte/prototipo/seo/` está vazio): robots e sitemap são **gerados** pelo build, um por ambiente.