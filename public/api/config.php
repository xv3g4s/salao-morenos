<?php
/**
 * Configuracao da integracao de avaliacoes do Google.
 *
 * NAO guarda segredo nenhum: a chave e os Place IDs vem do ambiente.
 * Ordem de leitura de cada variavel:
 *
 *   1. getenv()            — SetEnv no .htaccess, painel da hospedagem, etc.
 *   2. $_SERVER            — como o Apache entrega SetEnv em alguns setups
 *   3. ~/.morenos-env.php  — arquivo FORA do public_html, que devolve um array
 *
 * A terceira forma e a recomendada na HostGator: o arquivo fica fora da pasta
 * publicada, entao nem um erro de configuracao do Apache o expoe, e ele nao
 * passa pelo Git.
 *
 *   <?php  // ~/.morenos-env.php
 *   return [
 *     'GOOGLE_MAPS_API_KEY' => 'AIza...',
 *     'GOOGLE_PLACE_ID_CIDADE_CONTINENTAL' => 'ChIJ...',
 *     'GOOGLE_PLACE_ID_NOVO_HORIZONTE_AV_BRASIL' => 'ChIJ...',
 *     'GOOGLE_PLACE_ID_NOVO_HORIZONTE_AV_INDUSTRIAL' => 'ChIJ...',
 *   ];
 */

if (!defined('MORENOS_API')) {
    http_response_code(404);
    exit;
}

/** Le uma variavel de ambiente, com o arquivo fora do docroot como ultima opcao. */
function morenos_env(string $nome): ?string
{
    static $arquivo = null;
    if ($arquivo === null) {
        $arquivo = [];
        foreach ([getenv('MORENOS_ENV_FILE') ?: '', ($_SERVER['HOME'] ?? '') . '/.morenos-env.php'] as $caminho) {
            if (!$caminho || !is_file($caminho) || !is_readable($caminho)) {
                continue;
            }
            // Arquivo de ambiente quebrado nao pode derrubar a rota: ela
            // degrada para "nao configurado", que a tela ja sabe tratar.
            try {
                $lido = @include $caminho;
                if (is_array($lido)) {
                    $arquivo = $lido;
                } else {
                    error_log('[google-reviews] arquivo de ambiente ' . $caminho .
                        ' nao devolveu um array; ignorado.');
                }
            } catch (\Throwable $e) {
                error_log('[google-reviews] falha ao ler o arquivo de ambiente ' . $caminho . '.');
            }
            break;
        }
    }

    foreach ([getenv($nome), $_SERVER[$nome] ?? null, $arquivo[$nome] ?? null] as $valor) {
        if (is_string($valor) && trim($valor) !== '') {
            return trim($valor);
        }
    }
    return null;
}

/**
 * As tres unidades. Os Place IDs nao ficam espalhados pelo codigo: cada unidade
 * aponta para o nome da variavel de ambiente que guarda o seu.
 */
const MORENOS_UNIDADES = [
    [
        'id'         => 'cidade-continental',
        'name'       => 'Cidade Continental',
        'fullName'   => 'Salão Morenos — Cidade Continental',
        'placeIdEnv' => 'GOOGLE_PLACE_ID_CIDADE_CONTINENTAL',
    ],
    [
        'id'         => 'novo-horizonte-av-brasil',
        'name'       => 'Novo Horizonte — Av. Brasil',
        'fullName'   => 'Salão Morenos — Novo Horizonte, Avenida Brasil',
        'placeIdEnv' => 'GOOGLE_PLACE_ID_NOVO_HORIZONTE_AV_BRASIL',
    ],
    [
        'id'         => 'novo-horizonte-av-industrial',
        'name'       => 'Novo Horizonte — Av. Industrial',
        'fullName'   => 'Salão Morenos — Novo Horizonte, Avenida Industrial',
        'placeIdEnv' => 'GOOGLE_PLACE_ID_NOVO_HORIZONTE_AV_INDUSTRIAL',
    ],
];

/** Places API (New) — Place Details. */
const MORENOS_PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places/';

/** So os campos usados pela tela. Nunca "*". */
const MORENOS_FIELD_MASK = 'id,displayName,rating,userRatingCount,reviews,googleMapsUri,googleMapsLinks';

/** Tempo maximo por unidade. Uma unidade lenta nao pode segurar as outras. */
const MORENOS_TIMEOUT_MS = 6000;
