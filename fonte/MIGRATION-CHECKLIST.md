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
- [ ] rotas finais: ver `C.paths` em `site-config.js` e `seo/sitemap.xml`
- [ ] `seo/robots.txt` no domínio principal; `seo/robots-homologacao.txt` no novosite
- [ ] `C.env.stage` aplica noindex,nofollow automaticamente em novosite.*
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
