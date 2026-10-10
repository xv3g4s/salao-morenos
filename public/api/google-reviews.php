<?php
/**
 * /api/google-reviews — avaliacoes publicas das tres unidades no Google.
 *
 * Por que PHP: este site e HTML estatico publicado na HostGator por cPanel >
 * Git Version Control. Nao ha Node, Next.js nem Functions no plano; o que roda
 * no servidor aqui e PHP. Esta e a "funcao serverless adequada ao ambiente de
 * hospedagem" — a chave nunca sai do servidor, que e o ponto.
 *
 * Contrato:
 *   GET /api/google-reviews
 *   200  { units: [...], generatedAt, attribution }   com pelo menos uma unidade
 *   503  { error: "unavailable" }                     nenhuma unidade respondeu
 *   500  { error: "not_configured" }                  falta a chave
 *
 * Regras que o codigo cumpre e convem nao afrouxar:
 *   - a chave so existe aqui dentro: nao vai para a resposta, nem para o log
 *     de acesso, nem para o HTML;
 *   - nada e gravado: sem banco, sem arquivo, sem cache. Cache-Control
 *     no-store;
 *   - as tres unidades sao consultadas em paralelo, com timeout individual:
 *     uma falhando nao derruba as outras;
 *   - a resposta devolve so os campos que a tela usa, nunca o JSON cru do
 *     Google;
 *   - o texto da avaliacao sai como veio. Nao se corrige, resume ou filtra.
 */

declare(strict_types=1);

define('MORENOS_API', true);
require __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    header('Allow: GET');
    echo json_encode(['error' => 'method_not_allowed']);
    exit;
}

/** Log so no servidor. Nunca inclui a chave nem o corpo da resposta do Google. */
function morenos_log(string $msg): void
{
    error_log('[google-reviews] ' . $msg);
}

$chave = morenos_env('GOOGLE_MAPS_API_KEY');
if ($chave === null) {
    morenos_log('GOOGLE_MAPS_API_KEY ausente: a rota nao tem como consultar a Places API.');
    http_response_code(500);
    // A mensagem publica nao revela qual variavel falta.
    echo json_encode(['error' => 'not_configured']);
    exit;
}

// --------------------------------------------------------------- consulta ---

$alvos = [];
foreach (MORENOS_UNIDADES as $unidade) {
    $placeId = morenos_env($unidade['placeIdEnv']);
    if ($placeId === null) {
        morenos_log('Place ID nao configurado para ' . $unidade['name'] .
            ' (' . $unidade['placeIdEnv'] . '): unidade marcada como indisponivel.');
        $alvos[] = ['unidade' => $unidade, 'placeId' => null];
        continue;
    }
    $alvos[] = ['unidade' => $unidade, 'placeId' => $placeId];
}

$multi = curl_multi_init();
$handles = [];
foreach ($alvos as $i => $alvo) {
    if ($alvo['placeId'] === null) {
        continue;
    }
    $url = MORENOS_PLACES_ENDPOINT . rawurlencode($alvo['placeId'])
        . '?languageCode=pt-BR&regionCode=BR';
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT_MS     => MORENOS_TIMEOUT_MS,
        CURLOPT_CONNECTTIMEOUT_MS => 3000,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'X-Goog-Api-Key: ' . $chave,
            'X-Goog-FieldMask: ' . MORENOS_FIELD_MASK,
        ],
    ]);
    $handles[$i] = $ch;
    curl_multi_add_handle($multi, $ch);
}

if ($handles) {
    do {
        $status = curl_multi_exec($multi, $ativos);
        if ($ativos) {
            curl_multi_select($multi, 0.5);
        }
    } while ($ativos && $status === CURLM_OK);
}

// ------------------------------------------------------------ normalizacao --

/** Devolve o primeiro valor nao vazio de um caminho aninhado. */
function morenos_pega(array $dados, string ...$caminho)
{
    $atual = $dados;
    foreach ($caminho as $passo) {
        if (!is_array($atual) || !array_key_exists($passo, $atual)) {
            return null;
        }
        $atual = $atual[$passo];
    }
    return $atual === '' ? null : $atual;
}

/**
 * Uma avaliacao do Google no formato que a tela usa.
 * O texto nao e tocado: sai exatamente como o Google devolveu.
 */
function morenos_review(array $review, array $unidade, string $placeId): ?array
{
    $texto = morenos_pega($review, 'text', 'text');
    $original = morenos_pega($review, 'originalText', 'text');
    if ($texto === null && $original === null) {
        return null; // avaliacao so com nota, sem texto: nao vira card
    }

    $nome = morenos_pega($review, 'authorAttribution', 'displayName');
    $id = morenos_pega($review, 'name');

    return [
        'id'                  => is_string($id) && $id !== '' ? $id : null,
        'unitId'              => $unidade['id'],
        'unitName'            => $unidade['name'],
        'placeId'             => $placeId,
        'authorName'          => is_string($nome) && $nome !== '' ? $nome : 'Usuário do Google',
        'authorProfileUrl'    => morenos_pega($review, 'authorAttribution', 'uri'),
        'authorPhotoUrl'      => morenos_pega($review, 'authorAttribution', 'photoUri'),
        'rating'              => (float) (morenos_pega($review, 'rating') ?? 0),
        'text'                => $texto ?? $original,
        'textLanguage'        => morenos_pega($review, 'text', 'languageCode'),
        'originalText'        => $original,
        'originalLanguage'    => morenos_pega($review, 'originalText', 'languageCode'),
        'relativePublishTime' => morenos_pega($review, 'relativePublishTimeDescription'),
        'publishTime'         => morenos_pega($review, 'publishTime'),
        'googleMapsUrl'       => morenos_pega($review, 'googleMapsUri'),
        'flagContentUrl'      => morenos_pega($review, 'flagContentUri'),
    ];
}

$unidades = [];
$carregadas = 0;

foreach ($alvos as $i => $alvo) {
    $unidade = $alvo['unidade'];
    $base = [
        'id'          => $unidade['id'],
        'name'        => $unidade['name'],
        'displayName' => $unidade['fullName'],
        'placeId'     => null,
        'rating'      => null,
        'userRatingCount' => null,
        'placeUrl'    => null,
        'reviewsUrl'  => null,
        'writeReviewUrl' => null,
        'reviews'     => [],
        'available'   => false,
    ];

    if ($alvo['placeId'] === null || !isset($handles[$i])) {
        $unidades[] = $base;
        continue;
    }

    $ch = $handles[$i];
    $corpo = curl_multi_getcontent($ch);
    $http = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $erroCurl = curl_error($ch);
    curl_multi_remove_handle($multi, $ch);
    curl_close($ch);

    if ($erroCurl !== '') {
        morenos_log($unidade['name'] . ': falha de rede (' . $erroCurl . ')');
        $unidades[] = $base;
        continue;
    }
    if ($http !== 200) {
        // O corpo do erro do Google pode citar a chave: nao vai para o log.
        morenos_log($unidade['name'] . ': Places API respondeu HTTP ' . $http);
        $unidades[] = $base;
        continue;
    }

    $dados = json_decode((string) $corpo, true);
    if (!is_array($dados)) {
        morenos_log($unidade['name'] . ': resposta da Places API nao e JSON valido');
        $unidades[] = $base;
        continue;
    }

    $reviews = [];
    foreach ((array) ($dados['reviews'] ?? []) as $review) {
        if (!is_array($review)) {
            continue;
        }
        $normalizada = morenos_review($review, $unidade, $alvo['placeId']);
        if ($normalizada !== null) {
            // A ordem recebida e por relevancia: nao reordenar.
            $reviews[] = $normalizada;
        }
    }

    $unidades[] = array_merge($base, [
        'placeId'         => $alvo['placeId'],
        'rating'          => isset($dados['rating']) ? (float) $dados['rating'] : null,
        'userRatingCount' => isset($dados['userRatingCount']) ? (int) $dados['userRatingCount'] : null,
        'placeUrl'        => morenos_pega($dados, 'googleMapsLinks', 'placeUri')
                             ?? morenos_pega($dados, 'googleMapsUri'),
        'reviewsUrl'      => morenos_pega($dados, 'googleMapsLinks', 'reviewsUri'),
        'writeReviewUrl'  => morenos_pega($dados, 'googleMapsLinks', 'writeAReviewUri'),
        'reviews'         => $reviews,
        'available'       => true,
    ]);
    $carregadas++;
}

if ($handles) {
    curl_multi_close($multi);
}

if ($carregadas === 0) {
    http_response_code(503);
    echo json_encode(['error' => 'unavailable'], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode([
    'units'       => $unidades,
    'generatedAt' => gmdate('c'),
    'attribution' => 'Google Maps',
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
