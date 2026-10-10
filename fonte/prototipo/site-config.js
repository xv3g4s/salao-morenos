/* Salão Morenos — configuração central do site.
   Tudo que é telefone, link, endereço, horário, serviço, plano e SEO mora aqui.
   source: "legacy-site" = migrado do site antigo. needsConfirmation: true = validar com o cliente. */
(function () {
  var C = {};

  C.env = {
    // "homologacao" aplica noindex,nofollow. Mudar para "producao" ao migrar para o domínio principal.
    stage: /novosite\./.test(location.hostname) ? 'homologacao' : 'producao',
    siteUrl: 'https://salaomorenos.com.br',
  };

  C.brand = { name: 'Salão Morenos', city: 'Serra', state: 'ES', region: 'Serra — Espírito Santo' };

  C.integrations = {
    cashbarberHost: 'cashbarber.com.br',
    membershipPath: '/salaomorenos',
    bookingPath: '/salaomorenos/inicio',
  };
  C.links = {
    membership: 'https://' + C.integrations.cashbarberHost + C.integrations.membershipPath,
    booking: 'https://' + C.integrations.cashbarberHost + C.integrations.bookingPath,
  };

  C.whatsapp = {
    phone: '5527998713993', display: '+55 27 99871-3993', source: 'legacy-site', needsConfirmation: true,
    visitorMessage: 'Olá! Vim pelo seu site e quero agendar um corte como visitante',
  };
  C.waLink = function (msg) { return 'https://wa.me/' + C.whatsapp.phone + '?text=' + encodeURIComponent(msg || C.whatsapp.visitorMessage); };

  C.hours = {
    source: 'legacy-site', needsConfirmation: true,
    rows: [ { dias: 'Segunda a sexta', horario: '08:00 – 20:00' }, { dias: 'Sábado', horario: '09:00 – 18:00' } ],
    // Domingo não informado no site antigo: não exibir.
  };

  C.routes = {
    home: 'Home.dc.html', unidades: 'unidades.dc.html',
    'cidade-continental': 'cidade-continental.dc.html',
    'novo-horizonte-av-brasil': 'novo-horizonte-av-brasil.dc.html',
    'novo-horizonte-av-industrial': 'novo-horizonte-av-industrial.dc.html',
    servicos: 'servicos.dc.html', 'corte-masculino': 'corte-masculino.dc.html', barboterapia: 'barboterapia.dc.html',
    visagismo: 'visagismo.dc.html', 'dia-do-noivo': 'dia-do-noivo.dc.html', 'o-clube': 'o-clube.dc.html',
    cultura: 'cultura.dc.html', corporativo: 'corporativo.dc.html', 'trabalhe-conosco': 'trabalhe-conosco.dc.html',
    privacidade: 'politica-de-privacidade.dc.html', termos: 'termos-de-uso.dc.html',
  };
  // URL final de produção de cada página (sitemap/canonical).
  C.paths = {
    home: '/', unidades: '/unidades/',
    'cidade-continental': '/unidades/cidade-continental/',
    'novo-horizonte-av-brasil': '/unidades/novo-horizonte-av-brasil/',
    'novo-horizonte-av-industrial': '/unidades/novo-horizonte-av-industrial/',
    servicos: '/servicos/', 'corte-masculino': '/servicos/corte-masculino/', barboterapia: '/servicos/barboterapia/',
    visagismo: '/visagismo/', 'dia-do-noivo': '/dia-do-noivo/', 'o-clube': '/o-clube/',
    cultura: '/cultura/', corporativo: '/corporativo/', 'trabalhe-conosco': '/trabalhe-conosco/',
    privacidade: '/politica-de-privacidade/', termos: '/termos-de-uso/',
  };

  C.locations = [
    { id: 'cidade-continental', nome: 'Salão Morenos — Cidade Continental', curto: 'Cidade Continental',
      bairroLabel: 'Cidade Continental', logradouro: 'Avenida Terceiro Mundo', numero: null /* needsConfirmation */,
      bairro: 'Cidade Continental — Setor Ásia', cidade: 'Serra', estado: 'ES', cep: '29163-603',
      foto: 'img/unidade-cidade-continental.webp', fotoAlt: 'Fachada do Salão Morenos com a placa Cidade Continental', fotoConfirmada: true,
      bookingUrl: null /* TODO: substituir por bookingUrl específico após confirmação */, googleProfile: null },
    { id: 'novo-horizonte-av-brasil', nome: 'Salão Morenos — Novo Horizonte — Avenida Brasil', curto: 'Novo Horizonte — Av. Brasil',
      bairroLabel: 'Novo Horizonte', logradouro: 'Avenida Brasil', numero: null /* needsConfirmation: não usar números de fontes externas */,
      bairro: 'Novo Horizonte', cidade: 'Serra', estado: 'ES', cep: '29163-331',
      foto: 'img/unidade-av-brasil.webp', fotoAlt: 'Vitrine de uma unidade do Salão Morenos', fotoConfirmada: false,
      bookingUrl: null, googleProfile: null },
    { id: 'novo-horizonte-av-industrial', nome: 'Salão Morenos — Novo Horizonte — Avenida Industrial', curto: 'Novo Horizonte — Av. Industrial',
      bairroLabel: 'Novo Horizonte', logradouro: 'Avenida Industrial, 830 — Loja 3', numero: '830',
      bairro: 'Novo Horizonte', cidade: 'Serra', estado: 'ES', cep: '29163-357',
      foto: 'img/unidade-av-industrial.webp', fotoAlt: 'Fachada iluminada de uma unidade do Salão Morenos à noite', fotoConfirmada: false,
      bookingUrl: null, googleProfile: null },
  ];
  C.locations.forEach(function (l) {
    l.enderecoLinha = l.logradouro + ', ' + l.bairro + ', ' + l.cidade + ' — ' + l.estado + ', CEP ' + l.cep;
    l.rota = l.googleProfile || ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(l.logradouro + ', ' + l.bairro + ', ' + l.cidade + ' - ' + l.estado + ', ' + l.cep));
    l.mapaEmbed = 'https://maps.google.com/maps?q=' + encodeURIComponent(l.logradouro + ', ' + l.bairro + ', ' + l.cidade + ' - ' + l.estado + ', ' + l.cep) + '&z=16&output=embed';
    l.agendar = l.bookingUrl || C.links.booking;
    l.pagina = C.routes[l.id];
  });
  C.location = function (id) { for (var i = 0; i < C.locations.length; i++) if (C.locations[i].id === id) return C.locations[i]; return null; };

  // Durações: source legacy-site, needsConfirmation. Sem preços individuais.
  C.services = [
    { id: 'corte-masculino', nome: 'Corte Masculino', cat: 'cabelo', duracao: '30 min', pagina: 'corte-masculino',
      desc: 'Corte masculino personalizado de acordo com referências, estilo e preferência do cliente, com atenção ao acabamento.' },
    { id: 'corte-terapia', nome: 'Corte Terapia', cat: 'cabelo', duracao: '30 min', desc: 'Corte com um atendimento mais demorado e cuidadoso, para quem quer sair da rotina.' },
    { id: 'raspar-maquina', nome: 'Raspar na Máquina', cat: 'cabelo', duracao: '30 min', desc: 'Cabelo raspado na máquina, com acabamento nos contornos.' },
    { id: 'corte-kids', nome: 'Corte Kids', cat: 'cabelo', duracao: null, desc: 'Corte para crianças, com paciência e cuidado.' },
    { id: 'penteado', nome: 'Penteado Masculino', cat: 'cabelo', duracao: '30 min', desc: 'Finalização e penteado para uma ocasião ou para o dia a dia.' },
    { id: 'selagem', nome: 'Selagem Capilar', cat: 'cabelo', duracao: '30 min', desc: 'Tratamento que reduz o volume e alinha os fios.' },
    { id: 'camuflagem', nome: 'Camuflagem / Tintura', cat: 'cabelo', duracao: '30 min', desc: 'Suaviza os fios brancos ou muda a cor de forma discreta.' },
    { id: 'hidratacao', nome: 'Hidratação', cat: 'cabelo', duracao: '10 min', desc: 'Cuidado rápido para cabelo ressecado.' },
    { id: 'lavagem', nome: 'Lavagem Especial', cat: 'cabelo', duracao: '20 min', desc: 'Lavagem com mais tempo e cuidado com o couro cabeludo.' },
    { id: 'barba-alinhada', nome: 'Barba Alinhada', cat: 'barba', duracao: '20 min', desc: 'Desenho e alinhamento dos contornos da barba.' },
    { id: 'barboterapia', nome: 'Barboterapia', cat: 'barba', duracao: '40 min', pagina: 'barboterapia', desc: 'Cuidado completo com a barba, do preparo da pele à finalização.' },
    { id: 'sobrancelha', nome: 'Sobrancelha — Navalha ou Cera', cat: 'estetica', duracao: '10 min', desc: 'Limpeza e alinhamento das sobrancelhas.' },
    { id: 'remocao-pelos', nome: 'Remoção de Pelos — Nariz, Orelha e Sobrancelha (Máquina)', cat: 'estetica', duracao: '10 min', desc: 'Remoção com máquina dos pelos do nariz, da orelha e da sobrancelha.' },
    { id: 'depilacao', nome: 'Depilação — Nariz ou Orelha (Cera)', cat: 'estetica', duracao: '10 min', desc: 'Depilação com cera no nariz ou na orelha.' },
    { id: 'limpeza-pele', nome: 'Limpeza de Pele Masculina', cat: 'estetica', duracao: '10 min', desc: 'Limpeza rápida para tirar a oleosidade e as impurezas.' },
    { id: 'visagismo', nome: 'Consultoria de Visagismo', cat: 'consultoria', duracao: '2 horas', pagina: 'visagismo', desc: 'Conversa, análise do rosto e referências para definir corte e barba com você.' },
  ];
  C.services.forEach(function (s) { s.source = 'legacy-site'; s.needsConfirmation = true; });
  C.serviceCats = [
    { id: 'cabelo', nome: 'Cabelo' }, { id: 'barba', nome: 'Barba' }, { id: 'estetica', nome: 'Estética' }, { id: 'consultoria', nome: 'Consultoria' },
  ];

  C.clubPlans = [
    { id: 'corte-ilimitado', nome: 'Corte Ilimitado', tipo: ['ilimitados'], preco: 'R$ 79,90', desc: 'Para quem mantém o corte sempre em dia.',
      itens: ['Corte personalizado', 'Pezinho', 'Descontos especiais', 'Descontos em produtos da barbearia'] },
    { id: 'combo-supremo', nome: 'Combo Supremo Ilimitado', tipo: ['ilimitados'], preco: 'R$ 139,90', desc: 'Corte e barba no mesmo plano.',
      itens: ['Barba', 'Corte personalizado', 'Pezinho', 'Descontos especiais'] },
    { id: 'barba-premium', nome: 'Barba Premium Ilimitada', tipo: ['ilimitados'], preco: 'R$ 89,90', desc: 'Para quem cuida da barba com frequência.',
      itens: ['Barba', 'Descontos especiais'] },
    { id: 'plano-one', nome: 'Plano One', tipo: ['custo'], preco: 'R$ 30,00', desc: 'Só corte.',
      itens: ['Corte personalizado', 'Desconto em serviços da barbearia', 'Desconto em produtos'] },
    { id: 'plano-due', nome: 'Plano Due', tipo: ['custo'], preco: 'R$ 68,99', desc: 'Barba e corte ou 2 cortes.',
      itens: ['Cabelo ou barba', 'Desconto em serviços', 'Desconto em produtos'] },
    { id: 'familia-8', nome: 'Família Corte e Barba Clássico', tipo: ['familia'], preco: 'R$ 209,90', desc: '8 procedimentos mensais.',
      itens: ['Cabelo ou barba', 'Descontos em serviços', 'Descontos em produtos'] },
    { id: 'familia-6', nome: 'Família Corte e Barba Clássico', tipo: ['familia'], preco: 'R$ 169,90', desc: '6 procedimentos mensais.',
      itens: ['Cabelo ou barba', 'Descontos em serviços', 'Descontos em produtos'] },
  ];
  // "Periodicidade" e "Agendamentos simultâneos" aparecem sem valor no site antigo: não exibir.
  C.clubPlans.forEach(function (p) { p.source = 'legacy-site'; p.needsConfirmation = true; p.periodo = '/mês'; });
  C.clubFilters = [ { id: 'todos', nome: 'Todos' }, { id: 'ilimitados', nome: 'Ilimitados' }, { id: 'custo', nome: 'Custo-benefício' }, { id: 'familia', nome: 'Família' } ];

  C.corporatePlans = [
    { nome: 'Business Essential', preco: 'A partir de R$ 89/mês', desc: '1 corte por mês por colaborador.' },
    { nome: 'Business Premium', preco: 'A partir de R$ 169/mês', desc: 'Corte e barba mensais.' },
    { nome: 'Business Unlimited', preco: 'Sob consulta', desc: 'Corte e barba ilimitados.' },
    { nome: 'Eventos e convenções', preco: 'Sob consulta', desc: 'Atendimento em grupo, sob demanda.' },
  ];
  C.corporatePlans.forEach(function (p) { p.source = 'legacy-site'; p.needsConfirmation = true; });

  C.contactFlows = {
    noivo: 'Olá! Vim pelo site da Morenos e gostaria de informações sobre o Dia do Noivo.',
    corporativo: 'Olá! Vim pelo site da Morenos e gostaria de informações sobre os planos corporativos.',
    carreira: 'Olá! Vim pela página Trabalhe Conosco do site da Morenos e gostaria de enviar meu interesse profissional.',
  };

  // Analytics: sem IDs inventados. Preencher para carregar GTM/GA4 depois.
  C.analytics = { gtmId: null, ga4Id: null };
  C.track = function (evento, dados) {
    try { if (window.dataLayer && window.dataLayer.push) window.dataLayer.push(Object.assign({ event: evento }, dados || {})); } catch (e) {}
  };

  // Tela de abertura (site-loader.js). Para rever a abertura: abrir qualquer página com ?intro na URL,
  // ou rodar sessionStorage.removeItem('morenos_intro_seen') no console.
  C.loader = {
    showOncePerSession: false, // true = só na primeira página da sessão
    minimumVisibleTime: 1200,
    maximumVisibleTime: 4500,
    exitDuration: 560,
    sessionKey: 'morenos_intro_seen',
    logo: 'assets/morenos-loader-outline-white.webp', logoW: 720, logoH: 669,
  };

  C.selectedUnitKey = 'morenos_selected_unit';
  C.getUnit = function () { try { return localStorage.getItem(C.selectedUnitKey); } catch (e) { return null; } };
  C.setUnit = function (id) { try { localStorage.setItem(C.selectedUnitKey, id); } catch (e) {} C.track('unit_select', { unit: id }); };

  // Homologação: noindex,nofollow controlado só por aqui.
  if (C.env.stage === 'homologacao') {
    var m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex, nofollow'; document.head.appendChild(m);
  }

  window.MORENOS = C;
})();
