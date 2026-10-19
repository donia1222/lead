import { Lead } from "./types";
import { borrarUna, enElHosting, enFila, escribir, guardarUna, leer } from "./almacen";

/**
 * Los leads. Donde acaban guardados lo decide `almacen.ts`: el JSON del Mac o
 * el endpoint del hosting, segun esten puestas LEAD_API_URL y LEAD_API_TOKEN.
 */

const COL = "leads";

export async function getLeads(): Promise<Lead[]> {
  return leer<Lead>(COL);
}

export async function saveLead(lead: Lead) {
  return enFila(async () => {
    const leads = await leer<Lead>(COL);
    const i = leads.findIndex((l) => l.url === lead.url);
    const fila = i >= 0 ? { ...leads[i], ...lead } : lead;
    if (i >= 0) leads[i] = fila;
    else leads.push(fila);
    await guardarUna(COL, fila, leads);
  });
}

export async function updateLead(id: string, cambios: Partial<Lead>) {
  return enFila(async () => {
    const leads = await leer<Lead>(COL);
    const i = leads.findIndex((l) => l.id === id);
    if (i < 0) return;
    leads[i] = { ...leads[i], ...cambios };
    await guardarUna(COL, leads[i], leads);
  });
}

export async function deleteLead(id: string) {
  return enFila(async () => {
    const leads = await leer<Lead>(COL);
    await borrarUna(COL, id, leads);
  });
}

/**
 * Varios de golpe. Se hace en una sola pasada por el almacen en vez de llamar
 * a deleteLead() diez veces: en el hosting cada fila se borra sola, y en el
 * Mac el fichero se reescribe UNA vez en vez de diez.
 */
export async function deleteLeads(ids: string[]) {
  return enFila(async () => {
    const quitar = new Set(ids);
    const leads = await leer<Lead>(COL);
    const quedan = leads.filter((l) => !quitar.has(l.id));
    if (quedan.length === leads.length) return 0;
    if (!enElHosting()) {
      await escribir(COL, quedan);
      return leads.length - quedan.length;
    }
    for (const id of quitar) await borrarUna(COL, id, quedan);
    return leads.length - quedan.length;
  });
}

/** Lo mismo para cambiar el estado de varios (descartar, recuperar...). */
export async function updateLeads(ids: string[], cambios: Partial<Lead>) {
  return enFila(async () => {
    const tocar = new Set(ids);
    const leads = await leer<Lead>(COL);
    const nuevos = leads.map((l) => (tocar.has(l.id) ? { ...l, ...cambios } : l));
    const cambiados = nuevos.filter((l) => tocar.has(l.id));
    if (!cambiados.length) return 0;
    if (!enElHosting()) {
      await escribir(COL, nuevos);
      return cambiados.length;
    }
    for (const fila of cambiados) await guardarUna(COL, fila, nuevos);
    return cambiados.length;
  });
}

/** Para migrar de golpe lo que ya hubiera guardado. */
export async function guardarTodos(leads: Lead[]) {
  return enFila(() => escribir(COL, leads));
}
