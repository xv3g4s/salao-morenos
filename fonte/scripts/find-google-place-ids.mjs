/**
 * Encontra os Place IDs das tres unidades do Salão Morenos.
 *
 * Roda a mao, uma vez, por quem tem a chave:
 *
 *   GOOGLE_MAPS_API_KEY=AIza... npm run find:google-places
 *
 * Usa a API oficial Text Search (New) — nada de raspar pagina do Google.
 * Nao escolhe resultado sozinho quando ha mais de um candidato, e nao grava
 * nada: imprime os candidatos para conferencia pelo endereco e para o
 * fim os IDs irem para o ambiente da hospedagem, nunca para o repositorio.
 */
const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.googleMapsUri';

const CONSULTAS = [
  {
    unidade: 'Cidade Continental',
    variavel: 'GOOGLE_PLACE_ID_CIDADE_CONTINENTAL',
    confira: 'Avenida Terceiro Mundo · Cidade Continental (Setor Ásia) · CEP 29163-603',
    texto: 'Salão Morenos Avenida Terceiro Mundo Cidade Continental Serra ES',
  },
  {
    unidade: 'Novo Horizonte — Av. Brasil',
    variavel: 'GOOGLE_PLACE_ID_NOVO_HORIZONTE_AV_BRASIL',
    confira: 'Avenida Brasil · Novo Horizonte · CEP 29163-331',
    texto: 'Salão Morenos Avenida Brasil Novo Horizonte Serra ES',
  },
  {
    unidade: 'Novo Horizonte — Av. Industrial',
    variavel: 'GOOGLE_PLACE_ID_NOVO_HORIZONTE_AV_INDUSTRIAL',
    confira: 'Avenida Industrial, 830 — Loja 3 · Novo Horizonte · CEP 29163-357',
    texto: 'Salão Morenos Avenida Industrial 830 Loja 3 Novo Horizonte Serra ES',
  },
];

const chave = process.env.GOOGLE_MAPS_API_KEY;
if (!chave) {
  console.error('\nGOOGLE_MAPS_API_KEY nao esta no ambiente.\n');
  console.error('  GOOGLE_MAPS_API_KEY=AIza... npm run find:google-places\n');
  console.error('A chave precisa ter a Places API (New) habilitada e faturamento ativo.\n');
  process.exit(1);
}

async function buscar(consulta) {
  const resposta = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': chave,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: consulta.texto,
      languageCode: 'pt-BR',
      regionCode: 'BR',
    }),
  });

  if (!resposta.ok) {
    // A mensagem de erro do Google pode repetir a chave: so o status sai daqui.
    throw new Error(`Text Search respondeu HTTP ${resposta.status}`);
  }
  const dados = await resposta.json();
  return dados.places || [];
}

const risca = (n = 72) => '-'.repeat(n);

console.log('\nPlace IDs — Salão Morenos');
console.log('Text Search (New) · languageCode pt-BR · regionCode BR');

let faltou = false;

for (const consulta of CONSULTAS) {
  console.log('\n' + risca());
  console.log(`UNIDADE   ${consulta.unidade}`);
  console.log(`VARIAVEL  ${consulta.variavel}`);
  console.log(`CONSULTA  ${consulta.texto}`);
  console.log(`CONFIRA   ${consulta.confira}`);
  console.log(risca());

  let lugares;
  try {
    lugares = await buscar(consulta);
  } catch (erro) {
    console.log(`  erro: ${erro.message}`);
    faltou = true;
    continue;
  }

  if (!lugares.length) {
    console.log('  nenhum resultado. Ajuste a consulta ou confirme o endereco com o cliente.');
    faltou = true;
    continue;
  }

  lugares.forEach((lugar, i) => {
    console.log(`\n  [${i + 1}] ${lugar.displayName?.text || '(sem nome)'}`);
    console.log(`      Place ID  ${lugar.id}`);
    console.log(`      Endereco  ${lugar.formattedAddress || '(sem endereco)'}`);
    console.log(`      Maps      ${lugar.googleMapsUri || '(sem link)'}`);
  });

  if (lugares.length > 1) {
    console.log('\n  MAIS DE UM CANDIDATO: confira o endereco acima antes de escolher.');
    console.log('  Nada foi selecionado automaticamente.');
  }
}

console.log('\n' + risca());
console.log('Depois de validar CADA endereco, configure na hospedagem:');
CONSULTAS.forEach((c) => console.log(`  ${c.variavel}=`));
console.log('\nOs IDs vao para o ambiente (ou para ~/.morenos-env.php, fora do public_html).');
console.log('Nao commite Place ID nem chave neste repositorio.\n');

if (faltou) process.exit(2);
