# Salão Moreno's — site institucional

Landing page da barbearia Salão Moreno's (Serra, ES), com as três unidades,
serviços, galeria, FAQ e fluxo de agendamento.

## Estrutura

```
public/          -> tudo que vai para o ar (publicado em public_html)
  index.html       pagina unica
  support.js       runtime do Claude Design (dc-runtime)
  vendor/          React + ReactDOM servidos localmente
  fonts/           Poppins auto-hospedada (woff2)
  img/             imagens do site
  .htaccess        HTTPS, cache, compressao
.cpanel.yml      receita de deploy do cPanel (Git Version Control)
```

Nada fora de `public/` é publicado. Para adicionar um arquivo ao site,
coloque-o dentro de `public/`.

## Rodar localmente

```bash
cd public && npx http-server -p 8080
# abre http://127.0.0.1:8080
```

## Publicar

`git push` na branch de produção e, no cPanel > Git Version Control,
clicar em **Update from Remote** e depois **Deploy HEAD Commit**.

## Observações técnicas

- A página é renderizada no cliente pelo `dc-runtime`. React e ReactDOM são
  servidos de `public/vendor/` — não há dependência de CDN externo.
- `window.__resources` (no topo do `index.html`) é o ponto oficial do runtime
  para sobrescrever as URLs do CDN. Se o `support.js` for regerado pelo Claude
  Design, esse bloco precisa ser mantido.
- As imagens `img/fachada-noite.webp` e `img/interior-1.webp` são citadas em
  arrays de dados mas não são renderizadas (a galeria corta nas 6 primeiras e
  o card "Dia do Noivo" não exibe foto). Não precisam existir.
