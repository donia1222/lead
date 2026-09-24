<?php
// La busqueda entera, hecha en el servidor: local.ch, analisis de cada web y
// (si hay clave) el email con GPT. Asi el frontend no necesita secretos y el
// raspado sale desde el hosting suizo, no desde un centro de datos.
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-Lead-Codigo');
header('Access-Control-Allow-Methods: POST, OPTIONS');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') exit;
@set_time_limit(180);



function fin(array $d, int $codigo = 200): never {
  http_response_code($codigo);
  echo json_encode($d, JSON_UNESCAPED_UNICODE);
  exit;
}

const NAVEGADOR = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Una peticion GET, devolviendo [texto, codigo, milisegundos]. */
function traer(string $url, int $segundos = 12): array {
  $t = microtime(true);
  $c = curl_init($url);
  curl_setopt_array($c, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS => 4,
    CURLOPT_TIMEOUT => $segundos,
    CURLOPT_CONNECTTIMEOUT => 8,
    CURLOPT_USERAGENT => NAVEGADOR,
    CURLOPT_HTTPHEADER => ['Accept-Language: de-CH,de;q=0.9'],
    CURLOPT_SSL_VERIFYPEER => true,
  ]);
  $cuerpo = curl_exec($c);
  $codigo = (int) curl_getinfo($c, CURLINFO_HTTP_CODE);
  curl_close($c);
  return [is_string($cuerpo) ? $cuerpo : '', $codigo, (int) round((microtime(true) - $t) * 1000)];
}

const DIRECTORIOS = ['local.ch','localsearch.ch','search.ch','google','facebook.com','instagram.com','linkedin.com',
  'twitter.com','x.com','tripadvisor','yelp.com','youtube.com','wikipedia.org','renovero.ch','localcities.ch',
  // Sellos y botones que llevan muchas fichas y no son la web de nadie.
  'swissmadesoftware','trustpilot','provenexpert','ekomi','wa.me','api.whatsapp','t.me',
  'apple.com','play.google','maps.google','goo.gl','tiktok.com','pinterest.','xing.com'];
// Trastos de la propia pagina que no son la web de nadie: banner de cookies,
// tipografias, mapas... Sin esta lista, la «web del negocio» acaba siendo
// cdn.cookielaw.org, que es lo primero que aparece en el HTML.
const TRASTOS = ['cookielaw','onetrust','googleapis','gstatic','cloudflare','jsdelivr','unpkg','bootstrapcdn',
  'schema.org','w3.org','gravatar','doubleclick','googletagmanager','sentry','hotjar','cdn.','static.','assets.'];

function esWebDeNegocio(string $url): bool {
  if (!str_starts_with($url, 'http')) return false;
  foreach (DIRECTORIOS as $d) if (str_contains($url, $d)) return false;
  foreach (TRASTOS as $t) if (str_contains($url, $t)) return false;
  return true;
}

/** Quita acentos y deja letras, para comparar nombres con dominios. */
function llano(string $t): string {
  $t = strtolower(strtr($t, ['ä'=>'ae','ö'=>'oe','ü'=>'ue','é'=>'e','è'=>'e','à'=>'a','ç'=>'c','ß'=>'ss']));
  return preg_replace('/[^a-z0-9]/', '', $t);
}

/** De todos los enlaces de la ficha, el que mas se parece al nombre del negocio. */
function webDelNegocio(array $candidatos, string $nombre): string {
  if (!$candidatos) return '';
  $palabras = array_filter(preg_split('/\s+/', llano($nombre) === '' ? '' : $nombre), fn($p) => mb_strlen($p) > 3);
  foreach ($candidatos as $url) {
    $d = llano(dominio($url));
    foreach ($palabras as $p) if ($d !== '' && str_contains($d, llano($p))) return $url;
  }
  return $candidatos[0];
}

function dominio(string $url): string {
  $h = parse_url($url, PHP_URL_HOST);
  return $h ? preg_replace('/^www\./', '', strtolower($h)) : $url;
}

/** Busca negocios en local.ch: primero las fichas, luego cada ficha. */
function buscarEnLocalCh(string $que, string $donde, int $tope = 6): array {
  [$html] = traer('https://www.local.ch/de/q/' . rawurlencode($donde) . '/' . rawurlencode($que), 15);
  if ($html === '') return [];

  preg_match_all('#/de/d/[^"\'\s\\\\]+#', $html, $m);
  $caminos = array_values(array_unique(array_filter($m[0], fn($p) => strlen($p) > 15)));

  $fuera = [];
  foreach (array_slice($caminos, 0, $tope * 2) as $camino) {
    if (count($fuera) >= $tope) break;
    usleep(400000);
    [$ficha] = traer('https://www.local.ch' . str_replace('\\', '', $camino), 12);
    if ($ficha === '') continue;

    $nombre = '';
    if (preg_match('#<h1[^>]*>(.*?)</h1>#si', $ficha, $h)) $nombre = trim(html_entity_decode(strip_tags($h[1])));
    if ($nombre === '' || mb_strlen($nombre) > 60) {
      if (preg_match('#<title[^>]*>(.*?)</title>#si', $ficha, $t)) {
        $titulo = trim(preg_replace('/\s*[-|·–]\s*local\.ch.*$/i', '', html_entity_decode(strip_tags($t[1]))));
        if ($titulo !== '' && mb_strlen($titulo) <= 60) $nombre = $titulo;
      }
    }
    if ($nombre === '') continue;
    $nombre = preg_replace('/\s+/', ' ', $nombre);

    // Solo los enlaces de verdad (<a href>), no los <link> de la propia pagina.
    $candidatos = [];
    if (preg_match_all('#<a\b[^>]*href="(https?://[^"]+)"#i', $ficha, $hrefs)) {
      foreach ($hrefs[1] as $href) if (esWebDeNegocio($href)) $candidatos[] = $href;
    }
    $web = webDelNegocio(array_values(array_unique($candidatos)), $nombre);
    $email = preg_match('#mailto:([^"?]+)#i', $ficha, $e) ? trim($e[1]) : '';
    $tel = preg_match('#tel:(\+?[\d\s]{7,})#i', $ficha, $p) ? preg_replace('/\s+/', '', $p[1]) : '';

    $fuera[] = ['nombre' => $nombre, 'url' => $web, 'email' => $email, 'telefono' => $tel];
  }
  return $fuera;
}

/** Mira una web y apunta lo que le falta. */
function analizarWeb(string $url): array {
  $problemas = [];
  if (!str_starts_with($url, 'http')) $url = 'https://' . $url;
  $conSSL = str_starts_with($url, 'https');
  if (!$conSSL) $problemas[] = 'Sin SSL (no https)';

  [$html, $codigo, $ms] = traer($url, 14);
  if ($html === '') {
    return ['ok' => false, 'problemas' => ['Die Webseite antwortet nicht'], 'ssl' => $conSSL, 'movil' => false,
            'ms' => $ms, 'emails' => [], 'telefonos' => [], 'contacto' => '', 'resumen' => ''];
  }

  $movil = (bool) preg_match('#<meta[^>]+name=["\']viewport#i', $html);
  if (!$movil) $problemas[] = 'No se adapta al movil (sin viewport)';
  if ($ms > 3000) $problemas[] = 'Tarda en cargar (' . round($ms / 1000, 1) . ' s)';
  if (!preg_match('#<!DOCTYPE html>#i', $html)) $problemas[] = 'Sin DOCTYPE moderno';
  if (!preg_match('#<meta[^>]+name=["\']description#i', $html)) $problemas[] = 'Sin meta description SEO';
  if (!preg_match('#(kontakt|anfrage|termin|offerte|jetzt|buchen)#i', strip_tags($html))) $problemas[] = 'Sin llamada a la accion clara';
  if (!preg_match('#rel=["\']icon#i', $html)) $problemas[] = 'Sin favicon';
  if (preg_match_all('#<img(?![^>]*alt=)[^>]*>#i', $html, $sinAlt) && count($sinAlt[0]) > 2) $problemas[] = 'Imagenes sin texto alternativo';
  if (!preg_match('#(cookie|datenschutz)#i', $html)) $problemas[] = 'Sin aviso de cookies';

  // Los emails: fuera los de terceros que salen en avisos de cookies y demas
  // (dpo-google@google.com y parecidos), y delante el que es del mismo dominio
  // que la web, que es el del negocio.
  preg_match_all('#[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}#', $html, $me);
  $ajenos = ['google.com','gstatic.com','googlemail.com','sentry.io','wixpress.com','example.com','domain.com',
             'onetrust.com','cookielaw.org','wordpress.org','jimdo.com','squarespace.com','shopify.com','sitename'];
  $emails = [];
  foreach (array_unique($me[0]) as $x) {
    if (preg_match('#\.(png|jpg|jpeg|gif|webp|svg)$#i', $x)) continue;
    $suyo = strtolower(substr(strrchr($x, '@') ?: '', 1));
    $esAjeno = false;
    foreach ($ajenos as $a) if (str_contains($suyo, $a)) $esAjeno = true;
    if ($esAjeno) continue;
    $emails[] = $x;
  }
  // Y solo vale si puede ser suyo: o el dominio de su propia web, o un correo
  // corriente (gmail, gmx, bluewin...). Cualquier otro es de un tercero citado
  // en la pagina — el disenador, un proveedor, un socio— y escribirle a ese
  // seria peor que no escribir a nadie.
  $corrientes = ['gmail.com','gmx.','bluewin.ch','hotmail.','outlook.','yahoo.','icloud.com','me.com',
                 'sunrise.ch','hispeed.ch','protonmail.','proton.me','web.de','t-online.de','windowslive.com'];
  $casa = dominio($url);
  $suyos = [];
  foreach ($emails as $x) {
    $d = strtolower(substr(strrchr($x, '@') ?: '', 1));
    if ($d === $casa || str_contains($casa, $d) || str_contains($d, $casa)) { array_unshift($suyos, $x); continue; }
    foreach ($corrientes as $c) if (str_contains($d, $c)) { $suyos[] = $x; break; }
  }
  $emails = array_values(array_unique($suyos));
  preg_match_all('#(?:\+41|0)[\s\d]{9,}#', strip_tags($html), $mp);
  $telefonos = array_values(array_unique(array_map(fn($x) => preg_replace('/\s+/', '', $x), $mp[0])));

  $contacto = '';
  if (preg_match('#href="([^"]*(?:kontakt|contact|impressum)[^"]*)"#i', $html, $mc)) {
    $contacto = str_starts_with($mc[1], 'http') ? $mc[1] : rtrim($url, '/') . '/' . ltrim($mc[1], '/');
  }

  $datos = ['ok' => true, 'problemas' => $problemas, 'ssl' => $conSSL, 'movil' => $movil,
            'ms' => $ms, 'emails' => $emails, 'telefonos' => $telefonos, 'contacto' => $contacto];
  $datos['resumen'] = resumenDeLaWeb($html, $url, $datos);
  return $datos;
}

/**
 * Un resumen corto de la pagina para que GPT la pueda juzgar: lo que ve una
 * persona al entrar, no la lista de detalles tecnicos.
 */
function resumenDeLaWeb(string $html, string $url, array $a): string {
  $titulo = preg_match('#<title[^>]*>(.*?)</title>#si', $html, $m) ? trim(html_entity_decode(strip_tags($m[1]))) : '';
  $desc = preg_match('#<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']{0,300})#i', $html, $m) ? trim($m[1]) : '';
  $texto = preg_replace('/\s+/', ' ', strip_tags(preg_replace('#<(script|style|nav|footer)\b.*?</\1>#si', ' ', $html)));
  $anos = [];
  if (preg_match_all('/(?:©|&copy;|Copyright)[^0-9]{0,12}(19|20)\d{2}/i', $html, $mm)) $anos = array_slice($mm[0], 0, 3);
  $pistas = [];
  if (preg_match('#wp-content|wordpress#i', $html)) $pistas[] = 'WordPress';
  if (preg_match('#joomla#i', $html)) $pistas[] = 'Joomla';
  if (preg_match('#<table[^>]*>.*<table#si', $html)) $pistas[] = 'maquetado con tablas';
  if (preg_match('#\.swf|flash#i', $html)) $pistas[] = 'Flash';
  if (preg_match('#jimdo|wix|squarespace|webnode|digitalone#i', $html)) $pistas[] = 'constructor de paginas';

  return "URL: {$url}\n"
    . 'Titulo: ' . mb_substr($titulo, 0, 120) . "\n"
    . 'Descripcion: ' . mb_substr($desc, 0, 200) . "\n"
    . 'HTTPS: ' . ($a['ssl'] ? 'si' : 'no') . ' · Movil: ' . ($a['movil'] ? 'si' : 'no') . ' · Carga: ' . $a['ms'] . " ms\n"
    . ($anos ? 'Anos que aparecen: ' . implode(', ', $anos) . "\n" : '')
    . ($pistas ? 'Pistas: ' . implode(', ', $pistas) . "\n" : '')
    . "Texto visible (recortado):\n" . mb_substr($texto, 0, 1800);
}

/**
 * Que GPT mire la pagina y diga cuanto necesita una renovacion, en vez de
 * contar favicons. Devuelve nota de 0 a 100 y un par de motivos en aleman.
 * Si algo falla, se devuelve null y arriba se usa la cuenta de siempre.
 */
function juzgarWeb(string $clave, string $resumen): ?array {
  if ($clave === '') return null;
  $instruccion = <<<'TXT'
Du bist ein erfahrener Webdesigner in der Schweiz. Du bekommst die Zusammenfassung einer Firmenwebsite und beurteilst NUeCHTERN, wie dringend sie eine Erneuerung braucht.

Antworte NUR mit JSON, ohne Text drumherum:
{"nota": 0-100, "motivos": ["...", "..."], "resumen": "..."}

nota: 0 = moderne, gepflegte Seite, kein Handlungsbedarf. 100 = wirkt stark veraltet oder fehlt praktisch.
Orientierung: 0-25 gut, 26-50 kleinere Schwaechen, 51-75 deutlich veraltet, 76-100 dringend.
motivos: 1 bis 2 kurze Gruende auf Deutsch, aus Kundensicht, ohne Fachjargon (z.B. "wirkt wie aus den 2010ern", "am Handy schwer zu lesen"). Wenn die Seite gut ist, schreibe ehrlich warum sie gut ist.
resumen: ein Satz, was die Firma anbietet.

Sei streng mit dir selbst: erfinde keine Maengel. Wenn die Seite ordentlich ist, gib eine niedrige nota.
TXT;

  $cuerpo = json_encode([
    'model' => 'gpt-4.1',
    'messages' => [
      ['role' => 'system', 'content' => $instruccion],
      ['role' => 'user', 'content' => $resumen],
    ],
    'temperature' => 0.2,
    'response_format' => ['type' => 'json_object'],
  ], JSON_UNESCAPED_UNICODE);

  $c = curl_init('https://api.openai.com/v1/chat/completions');
  curl_setopt_array($c, [
    CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => $cuerpo,
    CURLOPT_TIMEOUT => 45,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $clave],
  ]);
  $r = json_decode((string) curl_exec($c), true);
  curl_close($c);
  $d = json_decode((string) ($r['choices'][0]['message']['content'] ?? ''), true);
  if (!is_array($d) || !isset($d['nota'])) return null;
  return [
    'nota' => max(0, min(100, (int) $d['nota'])),
    'motivos' => array_slice(array_map('strval', (array) ($d['motivos'] ?? [])), 0, 2),
    'resumen' => (string) ($d['resumen'] ?? ''),
  ];
}

function puntuacion(array $a): int {
  $p = 0;
  if (!$a['ssl']) $p += 20;
  if (!$a['movil']) $p += 20;
  if ($a['ms'] > 3000) $p += 10;
  $p += count($a['problemas']) * 7;
  return min($p, 100);
}

// ---------- secretos y entrada ----------

function buscarSecretosAqui(): string {
  $forzado = getenv('LEAD_SECURE_CONFIG');
  if ($forzado) return $forzado;
  $d = __DIR__;
  for ($i = 0; $i < 8; $i++) {
    if (is_file($d . '/secure_config/almacen.php')) return $d . '/secure_config';
    $padre = dirname($d);
    if ($padre === $d) break;
    $d = $padre;
  }
  return __DIR__ . '/../../../secure_config';
}

/** El email con GPT, con el mismo texto de siempre. */
function redactarEmail(string $clave, string $nombre, string $ciudad, string $sector, array $problemas, string $extra = ''): string {
  if ($clave === '') return '';
  $sinWeb = false;
  foreach ($problemas as $p) if (str_contains($p, 'Keine eigene Webseite') || str_contains($p, 'no responde')) $sinWeb = true;

  $contexto = $sinWeb
    ? "Dieser Betrieb hat KEINE funktionierende Website. Schreibe das Email so, dass du anbietest, eine professionelle Website von Grund auf zu erstellen. Betone, dass heutzutage fast alle Kunden zuerst im Internet nach einem {$sector} suchen und dass eine eigene Website sehr wichtig ist, um neue Kunden zu gewinnen. Halte es trotzdem kurz und freundlich."
    : 'Dieser Betrieb hat bereits eine Website. Biete an, sie aufzufrischen oder zu modernisieren.';

  $mensaje = "Email an \"{$nombre}\", ein {$sector} in {$ciudad}.\n{$contexto}";
  if ($extra !== '') {
    $mensaje .= "\n\nWICHTIG — DER BENUTZER HAT FOLGENDE SPEZIELLE ANWEISUNG GEGEBEN (hat hoechste Prioritaet, passe den Email-Inhalt entsprechend an):\n{$extra}";
  }

  $cuerpo = json_encode([
    'model' => 'gpt-4.1',
    'messages' => [
      ['role' => 'system', 'content' => require __DIR__ . '/prompt.php'],
      ['role' => 'user', 'content' => $mensaje],
    ],
    'temperature' => 0.7,
  ], JSON_UNESCAPED_UNICODE);

  $c = curl_init('https://api.openai.com/v1/chat/completions');
  curl_setopt_array($c, [
    CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => $cuerpo,
    CURLOPT_TIMEOUT => 60,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $clave],
  ]);
  $r = json_decode((string) curl_exec($c), true);
  curl_close($c);
  return (string) ($r['choices'][0]['message']['content'] ?? '');
}

// Solo actua como endpoint si se le llama directamente (asi se puede incluir
// desde otro fichero o desde una prueba sin que se dispare nada).
if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') !== 'buscar.php') return;
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fin(['error' => 'Solo POST'], 405);

$SECURE = buscarSecretosAqui();
if (!is_file($SECURE . '/almacen.php')) fin(['error' => 'No encuentro secure_config'], 500);
$ALMACEN = require $SECURE . '/almacen.php';
$CODIGO = (string) ($ALMACEN['lead_codigo'] ?? $ALMACEN['lead_token'] ?? '');
$CLAVE_OPENAI = (string) ($ALMACEN['openai_key'] ?? '');
if ($CODIGO === '') fin(['error' => 'Sin configurar en el servidor'], 500);

$dado = (string) ($_SERVER['HTTP_X_LEAD_CODIGO'] ?? '');
if ($dado === '' || !hash_equals($CODIGO, $dado)) fin(['error' => 'No autorizado'], 401);

$p = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($p)) fin(['error' => 'Cuerpo invalido'], 400);

// Analizar una sola web (el panel lo usa para añadir un negocio a mano).
if (!empty($p['url'])) {
  $url = (string) $p['url'];
  $nombre = trim((string) ($p['nombre'] ?? '')) ?: dominio($url);
  $sector = trim((string) ($p['sector'] ?? ''));
  $ciudad = trim((string) ($p['ciudad'] ?? ''));
  $a = analizarWeb($url);
  $juicio = $a['resumen'] !== '' ? juzgarWeb($CLAVE_OPENAI, $a['resumen']) : null;
  fin(['lead' => [
    'id' => bin2hex(random_bytes(8)),
    'name' => $nombre, 'sector' => $sector, 'city' => $ciudad, 'url' => $url,
    'email' => $a['emails'][0] ?? '', 'phone' => $a['telefonos'][0] ?? '',
    'contactPage' => $a['contacto'],
    'hasSSL' => $a['ssl'], 'hasViewport' => $a['movil'], 'loadTime' => $a['ms'],
    'score' => $juicio ? $juicio['nota'] : puntuacion($a),
    'problems' => ($juicio && $juicio['motivos']) ? $juicio['motivos'] : $a['problemas'],
    'status' => 'new',
    'emailDraft' => ($a['emails'][0] ?? '') !== '' ? redactarEmail($CLAVE_OPENAI, $nombre, $ciudad, $sector, $a['problemas']) : '',
    'createdAt' => date('c'),
  ]]);
}

$sector = trim((string) ($p['sector'] ?? ''));
$ciudad = trim((string) ($p['ciudad'] ?? ''));
$que = $sector !== '' ? $sector : trim((string) ($p['que'] ?? ''));
$cuantos = max(1, min(6, (int) ($p['cuantos'] ?? 6)));
$yaTengo = array_map('strval', (array) ($p['dominios'] ?? []));   // para no repetir
if ($que === '' || $ciudad === '') fin(['error' => 'Falta el sector o la ciudad'], 400);

$encontrados = buscarEnLocalCh($que, $ciudad, $cuantos + count($yaTengo));

$leads = [];
foreach ($encontrados as $n) {
  if (count($leads) >= $cuantos) break;
  if ($n['url'] !== '' && in_array(dominio($n['url']), $yaTengo, true)) continue;

  if ($n['url'] !== '') {
    $a = analizarWeb($n['url']);
    // Que la juzgue GPT mirando la pagina; la cuenta de detalles tecnicos solo
    // se usa si GPT no contesta.
    $juicio = $a['resumen'] !== '' ? juzgarWeb($CLAVE_OPENAI, $a['resumen']) : null;
    $score = $juicio ? $juicio['nota'] : puntuacion($a);
    $problemas = ($juicio && $juicio['motivos']) ? $juicio['motivos'] : $a['problemas'];
    $email = $n['email'] ?: ($a['emails'][0] ?? '');
    $tel = $n['telefono'] ?: ($a['telefonos'][0] ?? '');
    $contacto = $a['contacto'];
    $ssl = $a['ssl']; $movil = $a['movil']; $ms = $a['ms'];
  } else {
    // OJO: que local.ch no enlace una web NO significa que no la tengan. Se
    // dice lo que sabemos —no la hemos encontrado— y que lo mire una persona.
    $score = 50;
    $problemas = ['Auf local.ch ist keine Webseite verlinkt — bitte kurz pruefen'];
    $email = $n['email']; $tel = $n['telefono']; $contacto = '';
    $ssl = false; $movil = false; $ms = 0;
  }

  $leads[] = [
    'id' => bin2hex(random_bytes(8)),
    'name' => $n['nombre'], 'sector' => $sector, 'city' => $ciudad,
    'url' => $n['url'], 'email' => $email, 'phone' => $tel, 'contactPage' => $contacto,
    'hasSSL' => $ssl, 'hasViewport' => $movil, 'loadTime' => $ms,
    'score' => $score, 'problems' => $problemas, 'status' => 'new',
    // Sin web confirmada no se redacta nada: primero se mira, luego se escribe.
    'emailDraft' => ($email !== '' && $n['url'] !== '') ? redactarEmail($CLAVE_OPENAI, $n['nombre'], $ciudad, $sector, $problemas) : '',
    'createdAt' => date('c'),
  ];
}

fin(['leads' => $leads, 'mirados' => count($encontrados)]);
