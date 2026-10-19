<?php
/**
 * LEAD PROSPECTOR · mandar el email de un lead desde el servidor
 * Fichero: lead/phps/enviar.php
 *
 *   POST {para, asunto, texto, copia?, nombre?}  →  {ok:true}
 *   Cabecera X-Lead-Codigo (o X-Lead-Token), igual que lead.php.
 *
 * Por que existe: hasta ahora el borrador se copiaba a mano y se pegaba en el
 * programa de correo. Desde aqui sale directo, y sale DESDE EL DOMINIO, que es
 * lo que de verdad importa: un correo de captacion mandado desde una direccion
 * cualquiera acaba en no deseado.
 *
 * No se usa mail(): en Hostpoint lo que sale de mail() no lleva la firma del
 * dominio. Se entra en el buzon con usuario y contrasena, igual que en el panel
 * de Doris, y el correo sale firmado.
 *
 * En secure_config/almacen.php hacen falta:
 *   lead_smtp_host   asmtp.mail.hostpoint.ch
 *   lead_smtp_user   el buzon entero, p. ej. info@lweb.ch
 *   lead_smtp_pass   su contrasena
 *   lead_smtp_name   el nombre que se ve como remitente (opcional)
 *   lead_smtp_port   465 (cifrado desde el primer byte) o 587 (STARTTLS). Por defecto 465.
 *   lead_smtp_copia  1 para recibir siempre una copia oculta (opcional)
 * Si faltan host, user o pass, el boton avisa y no se manda nada.
 */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-Lead-Codigo, X-Lead-Token');
header('Access-Control-Allow-Methods: POST, OPTIONS');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') exit;
date_default_timezone_set('Europe/Zurich');
@set_time_limit(60);

function fin(array $d, int $codigo = 200): never {
  http_response_code($codigo);
  echo json_encode($d, JSON_UNESCAPED_UNICODE);
  exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fin(['error' => 'Metodo no permitido'], 405);

// Los secretos viven fuera de www. Se busca la carpeta hacia arriba en vez de
// contar niveles, igual que en lead.php: asi da igual donde acabe el fichero.
function buscarSecretos(): string {
  $forzado = getenv('LEAD_SECURE_CONFIG');
  if ($forzado) return $forzado;
  $d = __DIR__;
  for ($i = 0; $i < 8; $i++) {
    $c = $d . '/secure_config';
    if (is_file($c . '/almacen.php')) return $c;
    $padre = dirname($d);
    if ($padre === $d) break;
    $d = $padre;
  }
  return __DIR__ . '/../../../secure_config';
}
$SECURE = buscarSecretos();
if (!is_file($SECURE . '/almacen.php')) fin(['error' => 'No encuentro secure_config'], 500);
$ALMACEN = require $SECURE . '/almacen.php';

$TOKEN  = (string) ($ALMACEN['lead_token'] ?? '');
$CODIGO = (string) ($ALMACEN['lead_codigo'] ?? '');
if ($TOKEN === '' && $CODIGO === '') fin(['error' => 'Sin configurar en el servidor'], 500);

$dado = (string) ($_SERVER['HTTP_X_LEAD_CODIGO'] ?? $_SERVER['HTTP_X_LEAD_TOKEN'] ?? '');
$vale = ($TOKEN !== '' && hash_equals($TOKEN, $dado)) || ($CODIGO !== '' && hash_equals($CODIGO, $dado));
if ($dado === '' || !$vale) fin(['error' => 'No autorizado'], 401);

// Freno aparte del de lead.php: que un fallo del programa —o alguien con la
// sesion abierta— no pueda disparar cien correos a cien negocios.
$ip = $_SERVER['REMOTE_ADDR'] ?? 'x';
$f = sys_get_temp_dir() . '/rl_leadmail_' . md5($ip);
$ahora = time();
$marcas = is_file($f) ? array_filter(explode(',', (string) @file_get_contents($f)), fn($t) => is_numeric($t) && $ahora - (int) $t < 3600) : [];
if (count($marcas) >= 40) fin(['error' => 'Demasiados envios seguidos. Prueba dentro de un rato.'], 429);
$marcas[] = $ahora;
@file_put_contents($f, implode(',', $marcas), LOCK_EX);

$c = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($c)) fin(['error' => 'Cuerpo invalido'], 400);

$para   = trim((string) ($c['para'] ?? ''));
$asunto = trim((string) ($c['asunto'] ?? ''));
$texto  = (string) ($c['texto'] ?? '');
$nombre = trim((string) ($c['nombre'] ?? ''));

if (!filter_var($para, FILTER_VALIDATE_EMAIL)) fin(['error' => 'La direccion no es valida'], 400);
if (trim($texto) === '') fin(['error' => 'El email esta vacio'], 400);

// Si el borrador todavia trae dentro la linea del asunto, se saca de ahi y se
// quita del cuerpo: el que escribe GPT empieza por «Betreff: ...».
if (preg_match('/^(?:Betreff|Asunto|Subject|Objet|Oggetto):\s*(.+)$/mi', $texto, $m)) {
  if ($asunto === '') $asunto = trim($m[1]);
  $texto = trim(str_replace($m[0], '', $texto));
}
if ($asunto === '') $asunto = 'Ihre Webseite';

$host   = (string) ($ALMACEN['lead_smtp_host'] ?? '');
$user   = (string) ($ALMACEN['lead_smtp_user'] ?? '');
$pass   = (string) ($ALMACEN['lead_smtp_pass'] ?? '');
$nom    = (string) ($ALMACEN['lead_smtp_name'] ?? 'Lweb');
$puerto = (int) ($ALMACEN['lead_smtp_port'] ?? 465);
$copia  = array_key_exists('copia', $c) ? (bool) $c['copia'] : (bool) ($ALMACEN['lead_smtp_copia'] ?? true);
if ($host === '' || $user === '' || $pass === '') {
  fin(['error' => 'El buzon todavia no esta configurado en el servidor'], 500);
}

/** Una cabecera con acentos tiene que ir codificada o llega rota. */
function cab(string $t): string {
  return preg_match('/[^\x20-\x7E]/', $t) ? '=?UTF-8?B?' . base64_encode($t) . '?=' : $t;
}
/** Nada de saltos de linea en una cabecera: por ahi se cuelan destinatarios. */
function limpia(string $t): string {
  return trim(str_replace(["\r", "\n"], ' ', $t));
}

$para = limpia($para);
$de   = cab($nom) . ' <' . $user . '>';
$aQuien = $nombre !== '' ? cab(limpia($nombre)) . ' <' . $para . '>' : $para;

$cabeceras = [
  'From: ' . $de,
  'To: ' . $aQuien,
  'Reply-To: ' . $user,
  'Subject: ' . cab(limpia($asunto)),
  'Date: ' . date('r'),
  'Message-ID: <' . bin2hex(random_bytes(10)) . '@' . substr(strrchr($user, '@'), 1) . '>',
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=UTF-8',
  'Content-Transfer-Encoding: base64',
];
$mensaje = implode("\r\n", $cabeceras) . "\r\n\r\n"
         . chunk_split(base64_encode(str_replace("\r\n", "\n", $texto)));

/**
 * Un cliente SMTP corto: seis ordenes contadas. Se escribe aqui en vez de
 * traer una libreria entera porque una dependencia mas es una cosa mas que
 * mantener. Es el mismo que usa el panel de Doris.
 */
function smtp(string $host, int $puerto, string $user, string $pass, string $de,
              array $destinos, string $mensaje): void {
  // Hostpoint deja entrar por dos puertas: por el 465 la conexion va cifrada
  // desde el primer byte; por el 587 se empieza en claro y se cifra a mitad.
  $directo = ($puerto === 465);
  $s = @stream_socket_client(($directo ? 'ssl://' : 'tcp://') . $host . ':' . $puerto, $n, $e, 20);
  if (!$s) fin(['error' => 'No se puede hablar con el servidor de correo'], 502);
  stream_set_timeout($s, 20);

  $leer = function () use ($s): string {
    $todo = '';
    while (($linea = fgets($s, 1024)) !== false) {
      $todo .= $linea;
      if (strlen($linea) < 4 || $linea[3] !== '-') break;   // «250-...» sigue
    }
    return $todo;
  };
  $decir = function (string $orden, string $esperado) use ($s, $leer): string {
    if ($orden !== '') fwrite($s, $orden . "\r\n");
    $r = $leer();
    if (strncmp($r, $esperado, strlen($esperado)) !== 0) {
      fclose($s);
      // Lo que diga el servidor no se devuelve al navegador: puede traer el
      // nombre del buzon. Para el programa basta con que fallo.
      fin(['error' => 'El servidor de correo no ha aceptado el envio'], 502);
    }
    return $r;
  };

  $dominio = substr(strrchr($user, '@'), 1) ?: 'lweb.ch';
  $decir('', '220');
  $decir('EHLO ' . $dominio, '250');
  if (!$directo) {
    $decir('STARTTLS', '220');
    if (!stream_socket_enable_crypto($s, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
      fclose($s);
      fin(['error' => 'No se ha podido cifrar la conexion'], 502);
    }
    $decir('EHLO ' . $dominio, '250');   // despues de cifrar hay que volver a saludar
  }
  $decir('AUTH LOGIN', '334');
  $decir(base64_encode($user), '334');
  $decir(base64_encode($pass), '235');
  $decir('MAIL FROM:<' . $de . '>', '250');
  foreach ($destinos as $d) $decir('RCPT TO:<' . $d . '>', '250');
  $decir('DATA', '354');

  // Una linea que empieza por un punto corta el envio: se duplica. Es la regla
  // mas vieja del SMTP y la que mas veces se olvida.
  foreach (explode("\r\n", $mensaje) as $linea) {
    if (isset($linea[0]) && $linea[0] === '.') $linea = '.' . $linea;
    fwrite($s, $linea . "\r\n");
  }
  $decir('.', '250');
  @fwrite($s, "QUIT\r\n");
  fclose($s);
}

// La copia va en el sobre y NO como cabecera: el negocio no tiene por que ver
// que nos mandamos una copia. Asi queda constancia en el buzon, porque un
// correo mandado por SMTP no aparece solo en «Enviados».
$destinos = [$para];
if ($copia && strcasecmp($user, $para) !== 0) $destinos[] = $user;

smtp($host, $puerto, $user, $pass, $user, $destinos, $mensaje);

fin(['ok' => true, 'para' => $para, 'asunto' => $asunto, 'copia' => $copia]);
