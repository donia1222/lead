<?php
// Almacen de Lead Prospector. Vive en el hosting para que la herramienta funcione
// igual desde el Mac que desde Vercel, donde no hay disco donde escribir.
//
// Guarda filas sueltas de JSON: asi no hay que tocar la tabla cada vez que se
// añade un campo a un lead o a un negocio nuevo.
//
//   GET  lead.php?coleccion=leads              → todas las filas
//   POST lead.php                              → guardar una  {coleccion, id, datos}
//   POST lead.php?accion=lote                  → guardar varias {coleccion, filas:[{id,datos}]}
//   POST lead.php?accion=borrar                → borrar una  {coleccion, id}
//
// En todas, la cabecera X-Lead-Token con el token de almacen.php.
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-Lead-Token');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') exit;
date_default_timezone_set('Europe/Zurich');

function fin(array $d, int $codigo = 200): never {
  http_response_code($codigo);
  echo json_encode($d, JSON_UNESCAPED_UNICODE);
  exit;
}

// Credenciales fuera de www, como en el resto del hosting. Se busca la carpeta
// hacia arriba en vez de contar niveles: asi da igual si este fichero acaba en
// /lead/ o en /lead/phps/.
function buscarSecretos(): string {
  $forzado = getenv('LEAD_SECURE_CONFIG');
  if ($forzado) return $forzado;
  $d = __DIR__;
  for ($i = 0; $i < 8; $i++) {
    $c = $d . '/secure_config';
    if (is_file($c . '/db_credentials.php')) return $c;
    $padre = dirname($d);
    if ($padre === $d) break;
    $d = $padre;
  }
  return __DIR__ . '/../../../secure_config';
}
$SECURE = buscarSecretos();
if (!is_file($SECURE . '/db_credentials.php')) fin(['error' => 'No encuentro secure_config'], 500);
$CRED = (require $SECURE . '/db_credentials.php')['leadprospector'] ?? null;
$ALMACEN = require $SECURE . '/almacen.php';
// Vale el token (para llamadas de servidor a servidor) o el codigo de acceso
// que escribes al entrar, que es lo que manda el navegador.
$TOKEN = (string) ($ALMACEN['lead_token'] ?? '');
$CODIGO = (string) ($ALMACEN['lead_codigo'] ?? '');
if (!$CRED || ($TOKEN === '' && $CODIGO === '')) fin(['error' => 'Sin configurar en el servidor'], 500);

// Freno para quien lo llame en bucle (la IP solo de paso, en un temporal).
$ip = $_SERVER['REMOTE_ADDR'] ?? 'x';
$f = sys_get_temp_dir() . '/rl_lead_' . md5($ip);
$ahora = time();
$marcas = is_file($f) ? array_filter(explode(',', (string) @file_get_contents($f)), fn($t) => is_numeric($t) && $ahora - (int) $t < 60) : [];
if (count($marcas) >= 120) fin(['error' => 'Demasiadas peticiones'], 429);
$marcas[] = $ahora;
@file_put_contents($f, implode(',', $marcas), LOCK_EX);

// El token, comparado sin filtrar el tiempo que tarda.
$dado = (string) ($_SERVER['HTTP_X_LEAD_TOKEN'] ?? $_SERVER['HTTP_X_LEAD_CODIGO'] ?? '');
$vale = ($TOKEN !== '' && hash_equals($TOKEN, $dado)) || ($CODIGO !== '' && hash_equals($CODIGO, $dado));
if ($dado === '' || !$vale) fin(['error' => 'No autorizado'], 401);

$pdo = new PDO(
  "mysql:host={$CRED['host']};dbname={$CRED['db']};charset=utf8mb4",
  $CRED['user'], $CRED['pass'],
  [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
);

// La tabla se crea sola la primera vez.
$pdo->exec("CREATE TABLE IF NOT EXISTS lp_filas (
  coleccion VARCHAR(24) NOT NULL,
  id VARCHAR(64) NOT NULL,
  datos LONGTEXT NOT NULL,
  creado DATETIME NOT NULL,
  actualizado DATETIME NOT NULL,
  PRIMARY KEY (coleccion, id),
  KEY k_col (coleccion, actualizado)
) DEFAULT CHARSET=utf8mb4");

$coleccion = preg_replace('/[^a-z0-9_]/', '', strtolower((string) ($_GET['coleccion'] ?? '')));

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
  if ($coleccion === '') fin(['error' => 'Falta la coleccion'], 400);
  $st = $pdo->prepare('SELECT id, datos FROM lp_filas WHERE coleccion = ? ORDER BY creado ASC');
  $st->execute([$coleccion]);
  $filas = [];
  foreach ($st->fetchAll() as $r) {
    $d = json_decode((string) $r['datos'], true);
    if (is_array($d)) $filas[] = $d;
  }
  fin(['filas' => $filas]);
}

$cuerpo = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($cuerpo)) fin(['error' => 'Cuerpo invalido'], 400);
$coleccion = preg_replace('/[^a-z0-9_]/', '', strtolower((string) ($cuerpo['coleccion'] ?? $coleccion)));
if ($coleccion === '') fin(['error' => 'Falta la coleccion'], 400);
$accion = (string) ($_GET['accion'] ?? '');

if ($accion === 'borrar') {
  $id = (string) ($cuerpo['id'] ?? '');
  if ($id === '') fin(['error' => 'Falta el id'], 400);
  $pdo->prepare('DELETE FROM lp_filas WHERE coleccion = ? AND id = ?')->execute([$coleccion, $id]);
  fin(['ok' => true]);
}

$guardar = $pdo->prepare('INSERT INTO lp_filas (coleccion, id, datos, creado, actualizado)
  VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE datos = VALUES(datos), actualizado = VALUES(actualizado)');

$filas = $accion === 'lote' ? ($cuerpo['filas'] ?? []) : [['id' => $cuerpo['id'] ?? '', 'datos' => $cuerpo['datos'] ?? null]];
if (!is_array($filas)) fin(['error' => 'Filas invalidas'], 400);

$ahoraTexto = date('Y-m-d H:i:s');
$n = 0;
foreach ($filas as $fila) {
  $id = (string) ($fila['id'] ?? '');
  $datos = $fila['datos'] ?? null;
  if ($id === '' || !is_array($datos)) continue;
  $guardar->execute([$coleccion, $id, json_encode($datos, JSON_UNESCAPED_UNICODE), $ahoraTexto, $ahoraTexto]);
  $n++;
}
fin(['ok' => true, 'guardadas' => $n]);
