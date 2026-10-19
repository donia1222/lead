"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Programa, Icono, Rueda } from "@/components/programa";

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
  const [ajustes, setAjustes] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);

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
    <Programa
      titulo="Negocios nuevos"
      sub={`${nuevos.length} inscritos cerca · ${sinWeb} sin web`}
      acciones={
        <>
          <button className="btn claro chico" onClick={() => setAjustes((v) => !v)} aria-pressed={ajustes}>
            <Icono n="reloj" /> Ajustes
          </button>
          <button className="btn" onClick={refrescar} disabled={refrescando}>
            {refrescando ? <><Rueda /> Consultando el boletín…</> : <><Icono n="rehacer" /> Buscar altas</>}
          </button>
        </>
      }
      estado={
        <>
          <span className="estado">
            <i className={`punto ${refrescando ? "trabajando" : cargando ? "" : "si"}`} />
            {refrescando ? "Consultando el boletín oficial…" : cargando ? "Cargando…" : mensaje || "Datos al día"}
          </span>
          <span className="estado">
            <span className="cifra">{lista.length}</span> en pantalla
          </span>
          <span className="derecha">
            SHAB · {cantones.join(" ")} · últimos {dias} días · hasta {minutos} min
          </span>
        </>
      }
    >
      {ajustes && (
        <div className="tarjeta" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-end" }}>
            <div style={{ width: 110 }}>
              <label>Últimos días</label>
              <input type="number" min={1} max={90} value={dias} onChange={(e) => setDias(Number(e.target.value))} />
            </div>
            <div style={{ width: 150 }}>
              <label>Máximo en coche (min)</label>
              <input type="number" min={1} max={90} value={minutos} onChange={(e) => setMinutos(Number(e.target.value))} />
            </div>
            <div>
              <label>Cantones</label>
              <div className="fichas" style={{ maxHeight: "none", border: 0, padding: 0, background: "none" }}>
                {CANTONES.map((c) => {
                  const on = cantones.includes(c.id);
                  return (
                    <button key={c.id} aria-pressed={on}
                      onClick={() => setCantones((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))}>
                      {c.nombre}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <p style={{ fontSize: 12, color: "var(--suave)", margin: "12px 0 0", lineHeight: 1.5 }}>
            Del boletín oficial suizo (SHAB): quién se ha inscrito en el registro de comercio.
            El tiempo es en coche por carretera desde Sevelen. Liechtenstein tiene su propio
            registro y no sale aquí.
          </p>
        </div>
      )}

      <div className="filtros" style={{ marginBottom: 14, width: "fit-content", marginLeft: 0 }}>
        {pestanas.map((t) => (
          <button key={t.f} onClick={() => setFiltro(t.f)} aria-selected={filtro === t.f}>
            {t.t} <b>{t.n}</b>
          </button>
        ))}
      </div>

      {cargando ? (
        <div className="vacio">Cargando…</div>
      ) : lista.length === 0 ? (
        <div className="vacio">
          <b>Aquí no hay nada todavía</b>
          Pulsa «Buscar altas» y se mira el boletín oficial.
        </div>
      ) : (
        <div className="tabla"><table className="lista">
          <thead>
            <tr>
              <th style={{ width: 86 }}>Alta</th>
              <th>Negocio</th>
              <th className="op" style={{ width: 190 }}>Dónde</th>
              <th style={{ width: 120 }}>En coche</th>
              <th style={{ width: 190 }}>Contacto</th>
              <th style={{ width: 120 }} />
            </tr>
          </thead>
          <tbody>
            {lista.map((n) => {
              const abiertaEsta = abierta === n.id;
              const donde = `${n.direccion} ${n.plz} ${n.localidad}`.trim() || `${n.nombre} ${n.localidad}`;
              return (
                <Fragment key={n.id}>
                  <tr className={`fila${n.estado === "descartado" ? " apagada" : ""}${abiertaEsta ? " abierta" : ""}`}>
                    <td className="mono">{dia(n.fecha)}</td>
                    <td>
                      <div className="nombre">{n.nombre}</div>
                      <div className="donde">
                        {n.forma ? n.forma.replace(" (Neueintragung)", "") : "—"}
                        {n.estado === "visitado" && " · visitado"}
                        {n.estado === "descartado" && " · descartado"}
                      </div>
                    </td>
                    <td className="op">
                      {n.direccion && <div>{n.direccion}</div>}
                      <div className="donde">{n.plz} {n.localidad}</div>
                    </td>
                    <td>
                      <span className="cifra" style={{ fontWeight: 600 }}>
                        {n.minutos !== null ? `${n.minutos} min` : `${n.km} km`}
                      </span>
                      <div className="etiquetas" style={{ marginTop: 3 }}>
                        {!n.web ? <span className="eti ok">sin web</span> : <span className="eti gris">tiene web</span>}
                      </div>
                    </td>
                    <td>
                      {n.telefono && <div className="mono"><a href={`tel:${n.telefono}`}>{n.telefono}</a></div>}
                      {n.email && <div className="mono"><a href={`mailto:${n.email}`}>{n.email}</a></div>}
                      {!n.telefono && !n.email && <span style={{ color: "var(--suave)", fontSize: 12 }}>—</span>}
                    </td>
                    <td>
                      <div className="acciones">
                        <a className="btn claro chico" href={`https://www.google.com/maps/search/${encodeURIComponent(donde)}`}
                          target="_blank" rel="noreferrer">
                          <Icono n="mapa" /> Ir
                        </a>
                        <button className="btn plano" onClick={() => setAbierta(abiertaEsta ? null : n.id)}>
                          <Icono n="flecha" style={{ transform: abiertaEsta ? "rotate(180deg)" : undefined, transition: "transform .15s" }} />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {abiertaEsta && (
                    <tr className="detalle">
                      <td colSpan={6}>
                        {n.proposito && (
                          <p style={{ margin: "0 0 12px", fontSize: 13.5, color: "var(--tinta2)", lineHeight: 1.55 }}>
                            {n.proposito}
                          </p>
                        )}
                        {n.web && (
                          <p style={{ margin: "0 0 12px", fontSize: 13.5 }}>
                            <span style={{ color: "var(--suave)" }}>Posible web: </span>
                            <a href={n.web} target="_blank" rel="noreferrer" style={{ color: "var(--acento)" }}>{n.web}</a>
                          </p>
                        )}

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
                          <a className="btn claro chico" href={`https://www.zefix.ch/de/search/entity/list?name=${encodeURIComponent(n.nombre)}`}
                            target="_blank" rel="noreferrer">
                            <Icono n="sello" /> Ver en el registro
                          </a>
                          <span style={{ flex: 1 }} />
                          <button className="btn plano" onClick={() => marcar(n.id, { estado: n.estado === "visitado" ? "nuevo" : "visitado" })}>
                            <Icono n="visto" /> {n.estado === "visitado" ? "Quitar visita" : "Visitado"}
                          </button>
                          <button className="btn plano" onClick={() => marcar(n.id, { estado: n.estado === "descartado" ? "nuevo" : "descartado" })}>
                            <Icono n="caja" /> {n.estado === "descartado" ? "Recuperar" : "Descartar"}
                          </button>
                        </div>

                        <label>Nota</label>
                        <input
                          value={n.nota}
                          onChange={(e) => setNuevos((p) => p.map((x) => (x.id === n.id ? { ...x, nota: e.target.value } : x)))}
                          onBlur={(e) => marcar(n.id, { nota: e.target.value })}
                          placeholder="Con quién hablamos, qué dijeron…"
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table></div>
      )}
    </Programa>
  );
}
