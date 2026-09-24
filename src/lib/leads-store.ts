import { Lead } from "./types";
import { borrarUna, enFila, escribir, guardarUna, leer } from "./almacen";

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

/** Para migrar de golpe lo que ya hubiera guardado. */
export async function guardarTodos(leads: Lead[]) {
  return enFila(() => escribir(COL, leads));
}
