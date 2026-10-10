/* Salão Morenos — avaliações reais do Google na seção de depoimentos.
 *
 * O site é HTML estático pré-renderizado; a seção "Quem senta na cadeira,
 * conta." é desenhada no Claude Design. Este arquivo não redesenha nada: ele
 * assume o conteúdo da seção e o repinta com as avaliações que a rota
 * /api/google-reviews devolve, usando os mesmos tokens do design (fundo claro
 * #F6F4EF, cards brancos de raio 20px, Poppins, bronze #8A6F3E em fundo claro).
 *
 * Decisões que valem ficar registradas:
 *
 * - A chave da Places API nunca chega aqui. Este script só conhece a rota
 *   interna /api/google-reviews; quem fala com o Google é o PHP no servidor.
 * - Nada é gravado: sem localStorage, sem sessionStorage, sem cache. Os dados
 *   vivem em memória enquanto a página estiver aberta.
 * - A busca só começa quando a seção está a ~500px da tela
 *   (IntersectionObserver), porque ela fica longe da primeira dobra.
 * - A página viva é montada pelo runtime do Claude Design (React). Quando ele
 *   re-renderiza, o DOM desta seção é refeito e o que escrevemos some: um
 *   MutationObserver percebe e repinta a partir dos dados que já estão em
 *   memória, sem nova requisição.
 * - O texto da avaliação é impresso como veio. Nada de corrigir, resumir,
 *   traduzir de novo ou esconder crítica.
 */
(function () {
  'use strict';

  var ROTA = '/api/google-reviews';
  var TITULO = 'Quem senta na cadeira, conta.';
  var MARCA = 'data-avaliacoes-google';

  var T = {
    texto: '#0B0B0B', apoio: '#5F5C57', bronze: '#8A6F3E',
    cardBg: '#FFFFFF', borda: 'rgba(11,11,11,.12)', bordaForte: 'rgba(11,11,11,.2)',
    sombra: '0 18px 40px -28px rgba(11,11,11,.35)',
  };

  var estado = { dados: null, erro: false, carregando: false, filtro: 'todas', expandido: {}, original: {} };
  var secao = null, alvo = null;

  // --------------------------------------------------------------- utils ---
  function cria(tag, estilo, texto) {
    var el = document.createElement(tag);
    if (estilo) el.setAttribute('style', estilo);
    if (texto != null) el.textContent = texto;
    return el;
  }

  function evento(nome, dados) {
    try {
      if (window.dataLayer && typeof window.dataLayer.push === 'function') {
        window.dataLayer.push(Object.assign({ event: nome }, dados || {}));
      }
    } catch (e) { /* analytics nunca pode quebrar a interacao */ }
  }

  function externo(a) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
  }

  // ------------------------------------------------------ onde desenhar ----
  function acharSecao() {
    var porId = document.getElementById('avaliacoes');
    if (porId) return porId;
    var h2 = [].slice.call(document.querySelectorAll('h2'))
      .filter(function (h) { return (h.textContent || '').trim() === TITULO; })[0];
    return h2 ? h2.closest('section') || h2.parentElement.parentElement : null;
  }

  /* O container a repintar e o bloco que vem logo depois do cabecalho da
     secao: as colunas de depoimentos. Trocamos o conteudo dele e deixamos
     titulo, fundo e espacamento do design exatamente como estao. */
  function acharAlvo(sec) {
    var h2 = sec.querySelector('h2');
    if (!h2) return null;
    var cabecalho = h2.closest('div');
    if (!cabecalho || cabecalho === sec) return null;
    if (cabecalho.nextElementSibling) return cabecalho.nextElementSibling;
    var container = cabecalho.parentElement;
    var ultimo = container && container.lastElementChild;
    return ultimo && ultimo !== cabecalho ? ultimo : null;
  }

  // ------------------------------------------------------------ estrelas ---
  function estrelas(nota) {
    var caixa = cria('span', 'display:inline-flex;gap:2px;align-items:center');
    caixa.setAttribute('role', 'img');
    caixa.setAttribute('aria-label',
      'Avaliação de ' + String(nota).replace('.', ',') + ' de 5 estrelas');
    for (var i = 1; i <= 5; i++) {
      var cheia = nota >= i - 0.25;
      var s = cria('span',
        'font-size:15px;line-height:1;color:' + (cheia ? T.bronze : 'rgba(11,11,11,.22)'),
        '★');
      s.setAttribute('aria-hidden', 'true');
      caixa.appendChild(s);
    }
    return caixa;
  }

  function avatar(review) {
    if (review.authorPhotoUrl) {
      var img = document.createElement('img');
      img.src = review.authorPhotoUrl;
      img.alt = '';
      img.width = 40; img.height = 40;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer-when-downgrade';
      img.setAttribute('style',
        'flex-shrink:0;width:40px;height:40px;border-radius:50%;object-fit:cover;background:#EFEBE2');
      img.addEventListener('error', function () {
        if (img.parentNode) img.parentNode.replaceChild(iniciais(review), img);
      });
      return img;
    }
    return iniciais(review);
  }

  function iniciais(review) {
    var letra = (review.authorName || '?').trim().charAt(0).toUpperCase();
    var el = cria('span',
      'flex-shrink:0;width:40px;height:40px;border-radius:50%;background:#0B0B0B;color:#F6F4EF;' +
      'display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600', letra);
    el.setAttribute('aria-hidden', 'true');
    return el;
  }

  // --------------------------------------------------------------- card ----
  function card(review) {
    var bq = cria('blockquote',
      'margin:0;background:' + T.cardBg + ';border:1px solid ' + T.borda + ';border-radius:20px;' +
      'box-shadow:' + T.sombra + ';padding:28px;display:flex;flex-direction:column;gap:16px');

    var topo = cria('div', 'display:flex;align-items:center;justify-content:space-between;gap:12px');
    topo.appendChild(estrelas(review.rating));
    if (review.relativePublishTime) {
      topo.appendChild(cria('span', 'font-size:12px;color:' + T.apoio, review.relativePublishTime));
    }
    bq.appendChild(topo);

    var chave = review.id || (review.unitId + '|' + review.authorName);
    var mostrarOriginal = !!estado.original[chave];
    var corpo = mostrarOriginal && review.originalText ? review.originalText : review.text;
    var longo = (corpo || '').length > 260;
    var aberto = !!estado.expandido[chave];

    var p = cria('p',
      'margin:0;font-size:16px;line-height:1.6;color:' + T.texto +
      (longo && !aberto ? ';display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden' : ''),
      corpo);
    p.id = 'av-texto-' + Math.abs(hash(chave));
    bq.appendChild(p);

    if (longo) {
      var btn = cria('button',
        'align-self:flex-start;font-family:inherit;cursor:pointer;background:transparent;border:0;padding:6px 0;' +
        'min-height:32px;font-size:13px;font-weight:600;color:' + T.bronze + ';text-decoration:underline',
        aberto ? 'Mostrar menos' : 'Ler mais');
      btn.type = 'button';
      btn.setAttribute('aria-expanded', aberto ? 'true' : 'false');
      btn.setAttribute('aria-controls', p.id);
      btn.addEventListener('click', function () {
        estado.expandido[chave] = !estado.expandido[chave];
        pintar();
      });
      bq.appendChild(btn);
    }

    // Traducao: so quando o Google de fato traduziu.
    if (review.originalText && review.originalLanguage && review.textLanguage &&
        review.originalLanguage !== review.textLanguage) {
      var linhaT = cria('div', 'display:flex;align-items:center;gap:10px;flex-wrap:wrap');
      linhaT.appendChild(cria('span', 'font-size:12px;color:' + T.apoio,
        mostrarOriginal ? 'Texto original' : 'Traduzido pelo Google'));
      var ver = cria('button',
        'font-family:inherit;cursor:pointer;background:transparent;border:0;padding:4px 0;min-height:30px;' +
        'font-size:12px;font-weight:600;color:' + T.bronze + ';text-decoration:underline',
        mostrarOriginal ? 'Ver tradução' : 'Ver original');
      ver.type = 'button';
      ver.addEventListener('click', function () {
        estado.original[chave] = !estado.original[chave];
        pintar();
      });
      linhaT.appendChild(ver);
      bq.appendChild(linhaT);
    }

    var rodape = cria('footer', 'display:flex;align-items:center;gap:12px;margin-top:4px');
    rodape.appendChild(avatar(review));

    var quem = cria('span', 'display:flex;flex-direction:column;gap:2px;min-width:0');
    if (review.authorProfileUrl) {
      var a = externo(cria('a',
        'font-size:14px;font-weight:600;line-height:1.2;color:' + T.texto + ';text-decoration:underline',
        review.authorName));
      a.href = review.authorProfileUrl;
      quem.appendChild(a);
    } else {
      quem.appendChild(cria('span', 'font-size:14px;font-weight:600;line-height:1.2', review.authorName));
    }
    quem.appendChild(cria('span', 'font-size:12px;color:' + T.apoio + ';line-height:1.3',
      review.unitName));
    rodape.appendChild(quem);
    bq.appendChild(rodape);

    var links = cria('div', 'display:flex;flex-wrap:wrap;gap:14px;align-items:center');
    if (review.googleMapsUrl) {
      var lm = externo(cria('a',
        'font-size:12px;font-weight:600;letter-spacing:.06em;color:' + T.bronze + ';text-decoration:underline',
        'Ver no Google Maps'));
      lm.href = review.googleMapsUrl;
      lm.addEventListener('click', function () {
        evento('google_review_open', { unit_id: review.unitId, review_id: review.id || '' });
      });
      links.appendChild(lm);
    }
    if (review.flagContentUrl) {
      var fl = externo(cria('a', 'font-size:12px;color:' + T.apoio + ';text-decoration:underline',
        'Reportar avaliação no Google'));
      fl.href = review.flagContentUrl;
      links.appendChild(fl);
    }
    if (links.children.length) bq.appendChild(links);

    return bq;
  }

  function hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
    return h;
  }

  // ------------------------------------------------------------ filtros ----
  function filtros(unidades) {
    var barra = cria('div',
      'display:flex;flex-wrap:wrap;gap:10px;margin-bottom:22px;justify-content:center');
    barra.setAttribute('role', 'tablist');
    barra.setAttribute('aria-label', 'Filtrar avaliações por unidade');

    var opcoes = [{ id: 'todas', name: 'Todas' }].concat(
      unidades.filter(function (u) { return u.available; })
        .map(function (u) { return { id: u.id, name: u.name }; }));

    opcoes.forEach(function (o) {
      var ativa = estado.filtro === o.id;
      var b = cria('button',
        'font-family:inherit;cursor:pointer;white-space:nowrap;min-height:44px;padding:11px 18px;' +
        'border-radius:100px;font-size:12px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;' +
        'border:1px solid ' + (ativa ? '#0B0B0B' : T.bordaForte) + ';' +
        'background:' + (ativa ? '#0B0B0B' : 'transparent') + ';' +
        'color:' + (ativa ? '#FFFFFF' : T.apoio) + ';transition:background .3s ease,color .3s ease',
        o.name);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', ativa ? 'true' : 'false');
      b.addEventListener('click', function () {
        estado.filtro = o.id;
        evento('google_reviews_filter', { unit_id: o.id });
        pintar();
        anunciar(o.id === 'todas' ? 'Mostrando avaliações de todas as unidades'
                                  : 'Mostrando avaliações da unidade ' + o.name);
      });
      barra.appendChild(b);
    });
    return barra;
  }

  function anunciar(msg) {
    var vivo = document.getElementById('av-anuncio');
    if (vivo) vivo.textContent = msg;
  }

  // ------------------------------------------------------------ resumos ----
  function resumo(u) {
    var caixa = cria('div',
      'display:flex;flex-direction:column;gap:6px;padding:14px 18px;border:1px solid ' + T.borda +
      ';border-radius:16px;background:rgba(255,255,255,.6);min-width:0;flex:1 1 220px');
    caixa.appendChild(cria('span',
      'font-size:11px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:' + T.bronze,
      u.name));

    var linha = cria('div', 'display:flex;align-items:center;gap:10px;flex-wrap:wrap');
    if (u.rating) {
      linha.appendChild(cria('strong', 'font-size:20px;font-weight:700;color:' + T.texto,
        String(u.rating).replace('.', ',')));
      linha.appendChild(estrelas(u.rating));
    }
    caixa.appendChild(linha);

    if (u.userRatingCount) {
      caixa.appendChild(cria('span', 'font-size:13px;color:' + T.apoio,
        u.userRatingCount.toLocaleString('pt-BR') + ' avaliações no Google'));
    }

    var links = cria('div', 'display:flex;flex-wrap:wrap;gap:12px;margin-top:2px');
    if (u.reviewsUrl || u.placeUrl) {
      var todas = externo(cria('a',
        'font-size:12px;font-weight:600;color:' + T.bronze + ';text-decoration:underline',
        'Ver todas as avaliações'));
      todas.href = u.reviewsUrl || u.placeUrl;
      links.appendChild(todas);
    }
    if (u.writeReviewUrl) {
      var escrever = externo(cria('a',
        'font-size:12px;font-weight:600;color:' + T.apoio + ';text-decoration:underline',
        'Avaliar esta unidade'));
      escrever.href = u.writeReviewUrl;
      escrever.addEventListener('click', function () {
        evento('google_write_review_click', { unit_id: u.id });
      });
      links.appendChild(escrever);
    }
    if (links.children.length) caixa.appendChild(links);
    return caixa;
  }

  // ----------------------------------------------------------- selecao -----
  /* "Todas" intercala em round-robin, preservando a ordem de relevancia que o
     Google devolveu dentro de cada unidade. */
  function selecionar() {
    var unidades = (estado.dados && estado.dados.units) || [];
    if (estado.filtro !== 'todas') {
      var u = unidades.filter(function (x) { return x.id === estado.filtro; })[0];
      return u ? u.reviews.slice() : [];
    }
    var listas = unidades.map(function (x) { return x.reviews.slice(); });
    var saida = [], i = 0, restam = true;
    while (restam) {
      restam = false;
      for (var j = 0; j < listas.length; j++) {
        if (listas[j][i]) { saida.push(listas[j][i]); restam = true; }
      }
      i++;
    }
    return saida;
  }

  // --------------------------------------------------------- esqueleto -----
  function esqueleto() {
    var grade = cria('div',
      'display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px');
    grade.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 3; i++) {
      var c = cria('div',
        'background:' + T.cardBg + ';border:1px solid ' + T.borda + ';border-radius:20px;padding:28px;' +
        'display:flex;flex-direction:column;gap:14px;min-height:220px');
      [70, 100, 100, 85].forEach(function (largura) {
        c.appendChild(cria('span',
          'display:block;height:12px;width:' + largura + '%;border-radius:6px;background:rgba(11,11,11,.07)'));
      });
      grade.appendChild(c);
    }
    return grade;
  }

  // ------------------------------------------------------------- pintar ----
  function pintar() {
    // `parentNode` continua preenchido quando o no inteiro foi tirado da
    // pagina (a troca de camadas descarta a copia estatica de uma vez), entao
    // quem responde se ainda estamos na pagina e o document.
    if (!alvo || !document.contains(alvo)) return;

    var caixa = cria('div', MARCA ? '' : '');
    caixa.setAttribute(MARCA, '1');
    caixa.setAttribute('style', 'display:flex;flex-direction:column;gap:20px');

    var aviso = cria('p',
      'margin:0;font-size:13px;color:' + T.apoio + ';display:flex;align-items:center;gap:8px;flex-wrap:wrap');
    var fonte = cria('span', 'font-weight:600;color:' + T.texto, 'Google Maps');
    fonte.setAttribute('translate', 'no');
    aviso.appendChild(fonte);
    aviso.appendChild(cria('span', '', '· Avaliações do Google Maps, exibidas por relevância em cada unidade.'));
    caixa.appendChild(aviso);

    var vivo = cria('p', 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap');
    vivo.id = 'av-anuncio';
    vivo.setAttribute('aria-live', 'polite');
    caixa.appendChild(vivo);

    if (estado.carregando && !estado.dados) {
      caixa.appendChild(esqueleto());
    } else if (estado.erro || !estado.dados) {
      var erro = cria('div',
        'border:1px solid ' + T.borda + ';border-radius:20px;padding:28px;background:' + T.cardBg +
        ';display:flex;flex-direction:column;gap:12px;align-items:flex-start');
      erro.appendChild(cria('p', 'margin:0;font-size:16px;color:' + T.texto,
        'No momento não foi possível carregar as avaliações.'));
      var link = externo(cria('a',
        'font-size:13px;font-weight:600;color:' + T.bronze + ';text-decoration:underline',
        'Ver avaliações no Google Maps'));
      link.href = 'https://www.google.com/maps/search/' +
        encodeURIComponent('Salão Morenos Serra ES');
      erro.appendChild(link);
      caixa.appendChild(erro);
    } else {
      var unidades = estado.dados.units || [];
      var disponiveis = unidades.filter(function (u) { return u.available; });

      if (disponiveis.length > 1) caixa.appendChild(filtros(unidades));

      var resumos = cria('div', 'display:flex;flex-wrap:wrap;gap:12px');
      disponiveis
        .filter(function (u) { return estado.filtro === 'todas' || u.id === estado.filtro; })
        .forEach(function (u) { resumos.appendChild(resumo(u)); });
      if (resumos.children.length) caixa.appendChild(resumos);

      var lista = selecionar();
      if (!lista.length) {
        caixa.appendChild(cria('p', 'margin:0;font-size:15px;color:' + T.apoio,
          'Esta unidade ainda não tem avaliações com texto publicadas no Google.'));
      } else {
        var grade = cria('div',
          'display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px;align-items:start');
        lista.forEach(function (r) { grade.appendChild(card(r)); });
        caixa.appendChild(grade);
      }
    }

    alvo.parentNode.replaceChild(caixa, alvo);
    alvo = caixa;
  }

  // ------------------------------------------------------------- buscar ----
  function buscar() {
    if (estado.carregando || estado.dados) return;
    estado.carregando = true;
    pintar();

    fetch(ROTA, { cache: 'no-store', headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status);
        return r.json();
      })
      .then(function (dados) {
        if (!dados || !dados.units || !dados.units.some(function (u) { return u.available; })) {
          throw new Error('sem unidade disponivel');
        }
        estado.dados = dados;
        estado.erro = false;
        var total = dados.units.reduce(function (n, u) { return n + (u.reviews || []).length; }, 0);
        evento('google_reviews_loaded', {
          available_units: dados.units.filter(function (u) { return u.available; }).length,
          total_loaded_reviews: total,
        });
      })
      .catch(function () { estado.erro = true; })
      .then(function () {
        estado.carregando = false;
        pintar();
      });
  }

  // -------------------------------------------------------------- ligar ----
  function ligar() {
    var s = acharSecao();
    if (!s) return false;
    var a = acharAlvo(s);
    if (!a) return false;
    if (a.hasAttribute && a.hasAttribute(MARCA)) return true; // ja e nosso
    secao = s;
    alvo = a;
    pintar();

    if (estado.dados || estado.carregando) return true;
    if (!('IntersectionObserver' in window)) { buscar(); return true; }
    var io = new IntersectionObserver(function (ents) {
      if (ents.some(function (e) { return e.isIntersecting; })) {
        io.disconnect();
        buscar();
      }
    }, { rootMargin: '500px 0px' });
    io.observe(secao);
    return true;
  }

  /* O runtime do Claude Design re-renderiza a pagina inteira a cada mudanca de
     estado (menu, redimensionamento) e leva o nosso bloco junto. Quando isso
     acontece, voltamos a pintar com o que ja esta em memoria. */
  function vigiar() {
    var pendente = false;
    var mo = new MutationObserver(function () {
      if (alvo && document.contains(alvo) && alvo.hasAttribute(MARCA)) return;
      if (pendente) return;
      pendente = true;
      // espera o runtime terminar a renderizacao antes de repintar
      requestAnimationFrame(function () {
        pendente = false;
        alvo = null;
        ligar();
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  function iniciar() {
    if (!document.body) return;
    ligar();
    vigiar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
