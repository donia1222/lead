import { Nuevo } from "./types";
import { enFila, escribir, guardarUna, leer } from "./almacen";

/** Los negocios recien inscritos. Mismo almacen que los leads. */

const COL = "nuevos";

export async function getNuevos(): Promise<Nuevo[]> {
  const lista = await leer<Nuevo>(COL);
  return [...lista].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/**
 * Mete los que aun no estaban y deja en paz los que ya tenias: lo que hayas
 * marcado como visitado o descartado, y tus notas, no se pisan al refrescar.
 */
export async function fusionar(entrantes: Nuevo[]): Promise<Nuevo[]> {
  return enFila(async () => {
    const actuales = await leer<Nuevo>(COL);
    const porId = new Map(actuales.map((n) => [n.id, n]));
    const recien: Nuevo[] = [];

    for (const n of entrantes) {
      const viejo = porId.get(n.id);
      if (viejo) {
        porId.set(n.id, {
          ...n,
          estado: viejo.estado, nota: viejo.nota, web: viejo.web,
          email: viejo.email, telefono: viejo.telefono,
          webComprobada: viejo.webComprobada, creadoEn: viejo.creadoEn,
        });
      } else {
        porId.set(n.id, n);
        recien.push(n);
      }
    }

    await escribir(COL, [...porId.values()]);
    return recien;
  });
}

export async function actualizarNuevo(id: string, cambios: Partial<Nuevo>) {
  return enFila(async () => {
    const lista = await leer<Nuevo>(COL);
    const i = lista.findIndex((n) => n.id === id);
    if (i < 0) return;
    lista[i] = { ...lista[i], ...cambios };
    await guardarUna(COL, lista[i], lista);
  });
}
