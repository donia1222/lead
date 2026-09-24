<?php
// Negocios recien inscritos en el registro de comercio, cerca de casa.
// Igual que buscar.php: el trabajo pesado aqui, porque en Vercel no cabe en el
// tiempo que dan. Boletin oficial + situar en el mapa + minutos en coche + si
// tiene web.
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-Lead-Codigo');
header('Access-Control-Allow-Methods: POST, OPTIONS');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') exit;
@set_time_limit(300);

require_once __DIR__ . '/buscar.php';   // fin(), traer(), buscarEnLocalCh(), secretos

const SHAB = 'https://www.shab.ch/api/v1/publications';
/** Desde donde se mide. Es el centro de Sevelen. */
const CASA = ['lat' => 47.1122, 'lon' => 9.4902];

// ---------- memoria de lo ya averiguado ----------
// Los pueblos no se mueven y los trayectos tampoco: preguntarlo una vez basta.
// Se guarda en la misma tabla que todo lo demas; si la base de datos no
// estuviera, se sigue sin memoria (mas lento, pero funciona).

function baseDatos(): ?PDO {
  static $pdo = false;
  if ($pdo !== false) return $pdo;
  $pdo = null;
  try {
    $secure = buscarSecretosAqui();
    // Comprobar antes de require: si el fichero no esta, require mata el
    // proceso y ni el try lo salva.
    $cred = is_file($secure . '/db_credentials.php')
      ? ((require $secure . '/db_credentials.php')['leadprospector'] ?? null)
      : null;
    if ($cred) {
      $pdo = new PDO("mysql:host={$cred['host']};dbname={$cred['db']};charset=utf8mb4",
        $cred['user'], $cred['pass'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    }
  } catch (Throwable $e) {
    $pdo = null;
  }
  return $pdo;
}

function recordado(string $clave) {
  $pdo = baseDatos();
  if (!$pdo) return null;
  try {
    $st = $pdo->prepare('SELECT datos FROM lp_filas WHERE coleccion = ? AND id = ?');
    $st->execute(['lugares', $clave]);
    $f = $st->fetch();
    return $f ? json_decode((string) $f['datos'], true) : null;
  } catch (Throwable $e) {
    return null;
  }
}

function recordar(string $clave, $valor): void {
  $pdo = baseDatos();
  if (!$pdo) return;
  try {
    $ahora = date('Y-m-d H:i:s');
    $pdo->prepare('INSERT INTO lp_filas (coleccion, id, datos, creado, actualizado) VALUES (?,?,?,?,?)
      ON DUPLICATE KEY UPDATE datos = VALUES(datos), actualizado = VALUES(actualizado)')
      ->execute(['lugares', $clave, json_encode($valor, JSON_UNESCAPED_UNICODE), $ahora, $ahora]);
  } catch (Throwable $e) {}
}

// ---------- situar y medir ----------

function sinTildes(string $t): string {
  return strtolower(strtr($t, ['ä'=>'a','ö'=>'o','ü'=>'u','é'=>'e','è'=>'e','à'=>'a','ç'=>'c','ß'=>'ss','Ä'=>'a','Ö'=>'o','Ü'=>'u']));
}

function limpiarLocalidad(string $t): string {
  return trim(preg_replace('/\s*\([A-Z]{2}\)\s*$/', '', $t));
}

/**
 * El pueblo en el mapa. El canton NO es un adorno: «Buchs» a secas se lo lleva
 * swisstopo a Buchs (ZH), a 85 km, y el pueblo de al lado desaparece.
 */
function situarPueblo(string $localidad, string $canton) {
  $pueblo = limpiarLocalidad($localidad);
  if ($pueblo === '') return null;
  if (preg_match('/\(([A-Z]{2})\)\s*$/', $localidad, $m)) $canton = $m[1];
  $texto = trim("$pueblo $canton");
  $clave = 'p:' . sinTildes($texto);

  $guardado = recordado($clave);
  if (is_array($guardado)) return $guardado['lat'] ?? null ? $guardado : null;

  [$json] = traer('https://api3.geo.admin.ch/rest/services/ech/SearchServer?' . http_build_query([
    'searchText' => $texto, 'type' => 'locations', 'origins' => 'gg25,zipcode', 'limit' => 5, 'sr' => 4326,
  ]), 12);
  $d = json_decode($json, true);
  $punto = null;
  foreach (($d['results'] ?? []) as $r) {
    $a = $r['attrs'] ?? [];
    $etiqueta = sinTildes(strip_tags((string) ($a['label'] ?? '')));
    if (isset($a['lat'], $a['lon']) && str_starts_with(trim($etiqueta), sinTildes($pueblo))) {
      $punto = ['lat' => (float) $a['lat'], 'lon' => (float) $a['lon']];
      break;
    }
  }
  recordar($clave, $punto ?? ['lat' => null]);
  return $punto;
}

/** Una direccion exacta. El centro de un municipio no vale: el de Sevelen cae monte arriba. */
function situarDireccion(string $texto) {
  $clave = 'd:' . sinTildes(preg_replace('/\s+/', ' ', trim($texto)));
  $guardado = recordado($clave);
  if (is_array($guardado)) return $guardado['lat'] ?? null ? $guardado : null;

  [$json] = traer('https://api3.geo.admin.ch/rest/services/ech/SearchServer?' . http_build_query([
    'searchText' => $texto, 'type' => 'locations', 'origins' => 'address', 'limit' => 1, 'sr' => 4326,
  ]), 12);
  $a = json_decode($json, true)['results'][0]['attrs'] ?? null;
  $punto = (isset($a['lat'], $a['lon'])) ? ['lat' => (float) $a['lat'], 'lon' => (float) $a['lon']] : null;
  recordar($clave, $punto ?? ['lat' => null]);
  return $punto;
}

function kmEntre(array $a, array $b): float {
  $R = 6371; $r = fn($g) => $g * M_PI / 180;
  $dLat = $r($b['lat'] - $a['lat']); $dLon = $r($b['lon'] - $a['lon']);
  $s = sin($dLat / 2) ** 2 + cos($r($a['lat'])) * cos($r($b['lat'])) * sin($dLon / 2) ** 2;
  return round(2 * $R * asin(sqrt($s)), 1);
}

/** Minutos en coche por carretera. Si el ruteo no contesta, null. */
function minutosEnCoche(array $a, array $b): ?int {
  $clave = sprintf('r:%.4f,%.4f>%.4f,%.4f', $a['lat'], $a['lon'], $b['lat'], $b['lon']);
  $guardado = recordado($clave);
  if (is_array($guardado) && isset($guardado['min'])) return (int) $guardado['min'];

  [$json] = traer("https://router.project-osrm.org/route/v1/driving/{$a['lon']},{$a['lat']};{$b['lon']},{$b['lat']}?overview=false", 15);
  $d = json_decode($json, true)['routes'][0]['duration'] ?? null;
  if ($d === null) return null;
  $min = (int) round($d / 60);
  recordar($clave, ['min' => $min]);
  return $min;
}

/** «Neueintragung LeNail, Inh. Weiss, Oberriet (SG)» → nombre y localidad. */
function partirTitulo(string $titulo): array {
  $t = trim(preg_replace('/^Neueintragung\s+/i', '', $titulo));
  $corte = mb_strrpos($t, ',');
  if ($corte === false) return [$t, ''];
  return [trim(mb_substr($t, 0, $corte)), trim(mb_substr($t, $corte + 1))];
}

/** Del texto completo del boletin: calle, codigo postal, numero CHE, forma y proposito. */
function leerDetalle(string $xml): array {
  $texto = preg_replace('/\s+/', ' ', str_replace('&lt;br /&gt;', ' ', strip_tags($xml)));
  $uid = preg_match('/CHE-[\d.]+/', $texto, $m) ? $m[0] : '';
  $dir = preg_match('/CHE-[\d.]+,\s*([^,]+),\s*(\d{4})\s+([^,]+?),\s*([^,.]+)/', $texto, $d) ? $d : null;
  $prop = '';
  if (preg_match('/Zweck:\s*([^.]{10,400}\.)/', $texto, $p)) $prop = $p[1];
  elseif (preg_match('/bezweckt\s+([^.]{10,400}\.)/', $texto, $p)) $prop = $p[1];
  return [
    'direccion' => $dir ? trim($dir[1]) : '', 'plz' => $dir ? $dir[2] : '',
    'uid' => $uid, 'forma' => $dir ? trim($dir[4]) : '', 'proposito' => trim($prop),
  ];
}

// ---------- el endpoint ----------

if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') !== 'nuevos.php') return;
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fin(['error' => 'Solo POST'], 405);

$SECURE = buscarSecretosAqui();
if (!is_file($SECURE . '/almacen.php')) fin(['error' => 'No encuentro secure_config'], 500);
$ALMACEN = require $SECURE . '/almacen.php';
$CODIGO = (string) ($ALMACEN['lead_codigo'] ?? $ALMACEN['lead_token'] ?? '');
if ($CODIGO === '') fin(['error' => 'Sin configurar en el servidor'], 500);
$dado = (string) ($_SERVER['HTTP_X_LEAD_CODIGO'] ?? '');
if ($dado === '' || !hash_equals($CODIGO, $dado)) fin(['error' => 'No autorizado'], 401);

$p = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($p)) fin(['error' => 'Cuerpo invalido'], 400);

$dias = max(1, min(90, (int) ($p['dias'] ?? 14)));
$minutos = max(1, min(90, (int) ($p['minutos'] ?? 15)));
$cantones = array_values(array_filter(array_map(
  fn($c) => preg_replace('/[^A-Z]/', '', strtoupper((string) $c)),
  (array) ($p['cantones'] ?? ['SG'])
)));
if (!$cantones) $cantones = ['SG'];
// Los que ya tiene guardados: de esos no hace falta volver a averiguar nada.
$yaTengo = array_flip(array_map('strval', (array) ($p['yaTengo'] ?? [])));
// Por tandas: cada llamada trabaja un rato corto y dice cuantos quedan. Asi da
// igual el limite de tiempo del hosting o el de Vercel, que no son el mismo.
$tope = max(1, min(20, (int) ($p['tope'] ?? 5)));
$segundosTope = 20;
$empezado = microtime(true);
$pendientes = 0;

$params = [
  'publicationStates' => 'PUBLISHED', 'subRubrics' => 'HR01',
  'publicationDate.start' => date('Y-m-d', time() - $dias * 86400),
  'pageRequest.page' => '0', 'pageRequest.size' => '400',
];
$url = SHAB . '?' . http_build_query($params);
foreach ($cantones as $c) $url .= '&cantons=' . $c;

[$json, $codigo] = traer($url, 30);
$lista = json_decode($json, true)['content'] ?? null;
if (!is_array($lista)) fin(['error' => "El boletin no ha contestado (HTTP $codigo)"], 502);

// Un minuto de coche son como mucho ~2 km en linea recta por estos valles: se
// criba barato por pueblo y solo a los que quedan se les mide de verdad.
$cribaKm = $minutos * 2;
$nuevos = [];
$mirados = 0;

foreach ($lista as $pub) {
  $meta = $pub['meta'] ?? [];
  $id = (string) ($meta['publicationNumber'] ?? '');
  if ($id === '') continue;
  [$nombre, $localidad] = partirTitulo((string) ($meta['title']['de'] ?? ''));
  if ($nombre === '') continue;

  // Si ya lo tiene, no se gasta ni una peticion en el.
  if (isset($yaTengo[$id])) continue;

  // Si ya se ha trabajado bastante en esta tanda, se cuentan los que faltan y
  // se deja para la siguiente llamada.
  if (count($nuevos) >= $tope || microtime(true) - $empezado > $segundosTope) {
    $pendientes++;
    continue;
  }

  $puntoPueblo = situarPueblo($localidad, $cantones[0]);
  if (!$puntoPueblo) continue;
  if (kmEntre(CASA, $puntoPueblo) > $cribaKm) continue;
  $mirados++;

  $detalle = ['direccion' => '', 'plz' => '', 'uid' => '', 'forma' => '', 'proposito' => ''];
  [$xml] = traer(SHAB . '/' . $meta['id'] . '/xml', 20);
  if ($xml !== '') $detalle = leerDetalle($xml);

  $pueblo = limpiarLocalidad($localidad);
  $exacto = $detalle['direccion'] !== ''
    ? situarDireccion("{$detalle['direccion']}, {$detalle['plz']} {$pueblo}")
    : null;
  $destino = $exacto ?: $puntoPueblo;
  $enCoche = minutosEnCoche(CASA, $destino);
  $km = kmEntre(CASA, $destino);
  if ($enCoche !== null ? $enCoche > $minutos : $km > $minutos) continue;

  // ¿Tiene web? Se busca por nombre y pueblo en local.ch; de paso salen
  // telefono y email. Solo se acepta la ficha si el nombre se parece.
  $web = ''; $email = ''; $tel = '';
  $limpio = trim(preg_replace('/\b(GmbH|AG|KLG|SA|Inh\.|Einzelunternehmen|Verein|Holding)\b/i', '', $nombre));
  $palabras = array_values(array_filter(preg_split('/[^A-Za-zÀ-ÿ0-9]+/', $limpio), fn($w) => mb_strlen($w) > 3));
  $clave = $palabras[0] ?? $limpio;
  foreach (buscarEnLocalCh($limpio, $pueblo, 3) as $f) {
    if ($clave !== '' && str_contains(sinTildes($f['nombre']), sinTildes($clave))) {
      $web = $f['url']; $email = $f['email']; $tel = $f['telefono'];
      break;
    }
  }

  $nuevos[] = [
    'id' => $id, 'nombre' => $nombre, 'localidad' => $pueblo,
    'plz' => $detalle['plz'], 'direccion' => $detalle['direccion'], 'uid' => $detalle['uid'],
    'forma' => $detalle['forma'], 'proposito' => $detalle['proposito'],
    'fecha' => substr((string) ($meta['publicationDate'] ?? ''), 0, 10),
    'km' => $km, 'minutos' => $enCoche,
    'web' => $web, 'email' => $email, 'telefono' => $tel, 'webComprobada' => true,
    'estado' => 'nuevo', 'nota' => '', 'creadoEn' => date('c'),
  ];
}

usort($nuevos, fn($a, $b) => strcmp($b['fecha'], $a['fecha']));
fin([
  'nuevos' => $nuevos,
  'enElBoletin' => count($lista),
  'cerca' => $mirados,
  // Cuantos quedan por mirar. Mientras esto sea mayor que cero, hay que volver
  // a llamar (mandando tambien los recien traidos en «yaTengo»).
  'pendientes' => $pendientes,
  'segundos' => round(microtime(true) - $empezado, 1),
]);
