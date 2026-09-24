<?php
// Redactar o traducir el email del lead. Va aparte de buscar.php porque el
// panel los llama por su cuenta (botones «Generar email» y «Traducir»).
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-Lead-Codigo');
header('Access-Control-Allow-Methods: POST, OPTIONS');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') exit;
@set_time_limit(120);

require_once __DIR__ . '/buscar.php';   // trae fin(), redactarEmail() y los secretos

$SECURE = buscarSecretosAqui();
if (!is_file($SECURE . '/almacen.php')) fin(['error' => 'No encuentro secure_config'], 500);
$ALMACEN = require $SECURE . '/almacen.php';
$CODIGO = (string) ($ALMACEN['lead_codigo'] ?? $ALMACEN['lead_token'] ?? '');
$CLAVE = (string) ($ALMACEN['openai_key'] ?? '');
if ($CODIGO === '') fin(['error' => 'Sin configurar en el servidor'], 500);

$dado = (string) ($_SERVER['HTTP_X_LEAD_CODIGO'] ?? '');
if ($dado === '' || !hash_equals($CODIGO, $dado)) fin(['error' => 'No autorizado'], 401);
if ($CLAVE === '') fin(['error' => 'Falta openai_key en almacen.php'], 500);

$p = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($p)) fin(['error' => 'Cuerpo invalido'], 400);
$accion = (string) ($p['accion'] ?? 'generar');

if ($accion === 'traducir') {
  $texto = (string) ($p['email'] ?? '');
  $idioma = (string) ($p['idioma'] ?? 'de');
  if ($texto === '') fin(['error' => 'Falta el email'], 400);
  $idiomas = [
    'de' => 'Deutsch (Schweizer Hochdeutsch, ss statt ß)', 'es' => 'Español',
    'en' => 'English', 'it' => 'Italiano', 'fr' => 'Français',
  ];
  $nombre = $idiomas[$idioma] ?? $idioma;
  $cuerpo = json_encode([
    'model' => 'gpt-4.1',
    'messages' => [
      ['role' => 'system', 'content' => "Traduce el siguiente email a {$nombre}. Mantén el mismo tono cercano, cálido y informal. Mantén la firma exactamente igual (nombre, empresa, teléfono, email, URL, ciudad). No añadas ni quites contenido, solo traduce."],
      ['role' => 'user', 'content' => $texto],
    ],
    'temperature' => 0.3,
  ], JSON_UNESCAPED_UNICODE);

  $c = curl_init('https://api.openai.com/v1/chat/completions');
  curl_setopt_array($c, [
    CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => $cuerpo,
    CURLOPT_TIMEOUT => 60,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $CLAVE],
  ]);
  $r = json_decode((string) curl_exec($c), true);
  curl_close($c);
  $fuera = (string) ($r['choices'][0]['message']['content'] ?? '');
  if ($fuera === '') fin(['error' => 'OpenAI no ha contestado'], 502);
  fin(['email' => $fuera]);
}

$nombre = trim((string) ($p['nombre'] ?? ''));
if ($nombre === '') fin(['error' => 'Falta el nombre'], 400);
$email = redactarEmail(
  $CLAVE, $nombre,
  (string) ($p['ciudad'] ?? 'der Region'),
  (string) ($p['sector'] ?? 'Unternehmen'),
  array_map('strval', (array) ($p['problemas'] ?? [])),
  (string) ($p['extra'] ?? '')
);
if ($email === '') fin(['error' => 'OpenAI no ha contestado'], 502);
fin(['email' => $email]);
