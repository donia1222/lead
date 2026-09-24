/**
 * Sube al hosting lo que ya tengas guardado en los ficheros del Mac.
 *
 *   npx tsx herramientas/subir-al-hosting.ts
 *
 * Lee LEAD_API_URL y LEAD_API_TOKEN de .env.local (no los imprime). No borra
 * nada: si una fila ya esta arriba, la actualiza.
 */
import { promises as fs } from "fs";
import path from "path";

async function variables() {
  const texto = await fs.readFile(path.join(process.cwd(), ".env.local"), "utf-8");
  const v: Record<string, string> = {};
  for (const linea of texto.split("\n")) {
    const m = linea.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) v[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return v;
}

async function subir(coleccion: string, url: string, token: string) {
  let filas: { id: string }[] = [];
  try {
    const texto = await fs.readFile(path.join(process.cwd(), "data", `${coleccion}.json`), "utf-8");
    filas = texto ? JSON.parse(texto) : [];
  } catch {
    console.log(`  ${coleccion}: no hay fichero, nada que subir`);
    return;
  }
  if (!filas.length) {
    console.log(`  ${coleccion}: vacio`);
    return;
  }
  const r = await fetch(`${url}?accion=lote`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Lead-Token": token },
    body: JSON.stringify({ coleccion, filas: filas.map((f) => ({ id: f.id, datos: f })) }),
  });
  const d = await r.json().catch(() => ({}));
  console.log(`  ${coleccion}: ${r.ok ? `${d.guardadas} subidas` : `FALLO ${r.status} ${d.error ?? ""}`}`);
}

(async () => {
  const v = await variables();
  if (!v.LEAD_API_URL || !v.LEAD_API_TOKEN) {
    console.log("Faltan LEAD_API_URL o LEAD_API_TOKEN en .env.local");
    process.exit(1);
  }
  console.log("Subiendo a", v.LEAD_API_URL);
  await subir("leads", v.LEAD_API_URL, v.LEAD_API_TOKEN);
  await subir("nuevos", v.LEAD_API_URL, v.LEAD_API_TOKEN);
})();
