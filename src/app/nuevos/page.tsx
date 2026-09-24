"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface Nuevo {
  id: string;
  nombre: string;
  localidad: string;
  plz: string;
  direccion: string;
  uid: string;
  forma: string;
  proposito: string;
  fecha: string;
  km: number;
  minutos: number | null;
  web: string;
  email: string;
  telefono: string;
  webComprobada: boolean;
  estado: "nuevo" | "visitado" | "descartado";
  nota: string;
  creadoEn: string;
}

type Filtro = "todos" | "sinweb" | "nuevos" | "visitados" | "descartados";

const CANTONES = [
  { id: "SG", nombre: "St. Gallen" },
  { id: "GR", nombre: "Graubünden" },
  { id: "TG", nombre: "Thurgau" },
  { id: "AI", nombre: "Appenzell I." },
  { id: "AR", nombre: "Appenzell A." },
];

function dia(f: string) {
  if (!f) return "";
  const [a, m, d] = f.split("-");
  return `${d}.${m}.${a}`;
}

export default function NuevosPage() {
  const [nuevos, setNuevos] = useState<Nuevo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("sinweb");
  const [dias, setDias] = useState(30);
  const [minutos, setMinutos] = useState(15);
  const [cantones, setCantones] = useState<string[]>(["SG"]);

  const cargar = useCallback(async () => {
    const res = await fetch("/api/nuevos");
    const data = await res.json();
    setNuevos(data.nuevos || []);
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /**
   * El servidor trabaja por tandas cortas y dice cuantos le quedan: se le vuelve
   * a llamar hasta que no queda ninguno. Asi no hay llamada larga que pueda
   * cortarse por tiempo, y se van viendo los resultados segun llegan.
   */
  async function refrescar() {
    setRefrescando(true);
    setMensaje("");
    try {
      for (let vuelta = 0; vuelta < 12; vuelta++) {
        const res = await fetch("/api/nuevos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dias, minutos, cantones }),
        });
        const data = await res.json();
        if (data.error) { setMensaje(data.error); break; }
        setNuevos(data.nuevos || []);
        setMensaje(data.mensaje || "");
        if (!data.pendientes) break;
      }
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : "No se pudo consultar el boletín");
    }
    setRefrescando(false);
  }

  async function marcar(id: string, cambios: Partial<Nuevo>) {
    setNuevos((prev) => prev.map((n) => (n.id === id ? { ...n, ...cambios } : n)));
    await fetch("/api/nuevos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...cambios }),
    });
  }

  const lista = useMemo(() => {
    const f = nuevos.filter((n) => {
      if (filtro === "todos") return n.estado !== "descartado";
      if (filtro === "sinweb") return !n.web && n.estado !== "descartado";
      if (filtro === "nuevos") return n.estado === "nuevo";
      if (filtro === "visitados") return n.estado === "visitado";
      return n.estado === "descartado";
    });
    return f.sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [nuevos, filtro]);

  const sinWeb = nuevos.filter((n) => !n.web && n.estado !== "descartado").length;

  const pestanas: { f: Filtro; t: string; n: number }[] = [
    { f: "sinweb", t: "Sin web", n: sinWeb },
    { f: "todos", t: "Todos", n: nuevos.filter((n) => n.estado !== "descartado").length },
    { f: "visitados", t: "Visitados", n: nuevos.filter((n) => n.estado === "visitado").length },
    { f: "descartados", t: "Descartados", n: nuevos.filter((n) => n.estado === "descartado").length },
  ];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white/80 backdrop-blur border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <a href="/" className="w-9 h-9 rounded-xl bg-slate-900 text-white grid place-items-center font-bold" title="Volver al panel">←</a>
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-tight">Negocios nuevos</h1>
              <p className="text-xs text-slate-500">
                {nuevos.length} inscritos cerca · {sinWeb} sin web
              </p>
            </div>
          </div>
          <button
            onClick={refrescar}
            disabled={refrescando}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 shadow-sm"
          >
            {refrescando ? "Consultando el boletín…" : "Buscar altas"}
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Ajustes de la búsqueda */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5">
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-sm">
              <span className="block text-xs text-slate-500 mb-1">Últimos días</span>
              <input
                type="number" min={1} max={90} value={dias}
                onChange={(e) => setDias(Number(e.target.value))}
                className="w-24 px-3 py-1.5 border border-slate-300 rounded-lg"
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-slate-500 mb-1">Máximo en coche (min)</span>
              <input
                type="number" min={1} max={90} value={minutos}
                onChange={(e) => setMinutos(Number(e.target.value))}
                className="w-24 px-3 py-1.5 border border-slate-300 rounded-lg"
              />
            </label>
            <div className="text-sm">
              <span className="block text-xs text-slate-500 mb-1">Cantones</span>
              <div className="flex flex-wrap gap-1.5">
                {CANTONES.map((c) => {
                  const on = cantones.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => setCantones((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                        on ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {c.nombre}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Del boletín oficial suizo (SHAB): quién se ha inscrito en el registro de comercio.
            El tiempo es en coche por carretera desde Sevelen. Liechtenstein tiene su propio
            registro y no sale aquí.
          </p>
          {mensaje && <p className="text-xs text-indigo-700 mt-2 font-medium">{mensaje}</p>}
        </div>

        {/* Pestañas */}
        <div className="flex gap-1 overflow-x-auto pb-1 mb-4">
          {pestanas.map((t) => (
            <button
              key={t.f}
              onClick={() => setFiltro(t.f)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                filtro === t.f ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t.t}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${filtro === t.f ? "bg-white/20" : "bg-slate-200 text-slate-600"}`}>
                {t.n}
              </span>
            </button>
          ))}
        </div>

        {cargando ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : lista.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center">
            <p className="text-sm text-slate-600">Aquí no hay nada todavía.</p>
            <p className="text-xs text-slate-400 mt-1">Pulsa «Buscar altas» para mirar el boletín.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lista.map((n) => (
              <article key={n.id} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex flex-col gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold">{n.nombre}</h2>
                      {!n.web && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          sin web
                        </span>
                      )}
                      {n.estado === "visitado" && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">visitado</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {dia(n.fecha)} · {n.localidad}
                      {n.minutos !== null ? ` · ${n.minutos} min en coche` : ` · ${n.km} km`}
                      {n.forma ? ` · ${n.forma.replace(" (Neueintragung)", "")}` : ""}
                    </p>
                    {n.direccion && (
                      <p className="text-sm text-slate-600 mt-1">
                        {n.direccion}, {n.plz} {n.localidad}
                      </p>
                    )}
                    {n.proposito && <p className="text-sm text-slate-500 mt-2 leading-relaxed">{n.proposito}</p>}
                    {(n.telefono || n.email) && (
                      <p className="text-sm mt-2 flex flex-wrap gap-x-4 gap-y-1">
                        {n.telefono && (
                          <a href={`tel:${n.telefono}`} className="text-slate-700 hover:underline">{n.telefono}</a>
                        )}
                        {n.email && (
                          <a href={`mailto:${n.email}`} className="text-slate-700 hover:underline break-all">{n.email}</a>
                        )}
                      </p>
                    )}
                    {n.web && (
                      <p className="text-sm mt-2">
                        <span className="text-slate-500">Posible web: </span>
                        <a href={n.web} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline break-all">
                          {n.web}
                        </a>
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <a
                      href={`https://www.google.com/maps/search/${encodeURIComponent(
                        `${n.direccion} ${n.plz} ${n.localidad}`.trim() || `${n.nombre} ${n.localidad}`
                      )}`}
                      target="_blank" rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 text-center"
                    >
                      Cómo llegar
                    </a>
                    <a
                      href={`https://www.zefix.ch/de/search/entity/list?name=${encodeURIComponent(n.nombre)}`}
                      target="_blank" rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 text-center"
                    >
                      Registro
                    </a>
                    <button
                      onClick={() => marcar(n.id, { estado: n.estado === "visitado" ? "nuevo" : "visitado" })}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
                    >
                      {n.estado === "visitado" ? "Quitar visita" : "Visitado"}
                    </button>
                    <button
                      onClick={() => marcar(n.id, { estado: n.estado === "descartado" ? "nuevo" : "descartado" })}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100"
                    >
                      {n.estado === "descartado" ? "Recuperar" : "Descartar"}
                    </button>
                  </div>
                </div>

                <input
                  value={n.nota}
                  onChange={(e) => setNuevos((p) => p.map((x) => (x.id === n.id ? { ...x, nota: e.target.value } : x)))}
                  onBlur={(e) => marcar(n.id, { nota: e.target.value })}
                  placeholder="Nota: con quién hablamos, qué dijeron…"
                  className="mt-3 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-slate-300 outline-none"
                />
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
