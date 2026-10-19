"use client";

/**
 * El armazon del programa: el menu de la izquierda, la barra de titulo y la
 * barra de estado. Lo comparten las dos secciones (Leads y Negocios nuevos),
 * asi que el menu se escribe una sola vez y las dos se ven siempre iguales.
 *
 * Es el mismo armazon del panel de Verwaltung a proposito: misma paleta,
 * mismo ancho de lateral y mismo logo. Son dos programas de la misma casa.
 */

import { usePathname } from "next/navigation";

const ICONOS: Record<string, string> = {
  mas: "M12 5v14M5 12h14",
  x: "M6 6l12 12M18 6L6 18",
  lupa: "M21 21l-4.3-4.3M11 18a7 7 0 100-14 7 7 0 000 14z",
  bajar: "M12 4v12m0 0l-4-4m4 4l4-4M4 20h16",
  globo: "M12 21a9 9 0 100-18 9 9 0 000 18zM3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18",
  sobre: "M4 6h16v12H4zM4 7l8 6 8-6",
  tel: "M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z",
  enviar: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  rehacer: "M4 4v5h5M20 20v-5h-5M5.5 15a7 7 0 0012.4 2M18.5 9A7 7 0 006.1 7",
  chispas: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z",
  visto: "M5 13l4 4L19 7",
  caja: "M4 7h16M5 7l1 13h12l1-13M9 4h6M10 11v5M14 11v5",
  volver: "M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3",
  papelera: "M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3",
  flecha: "M6 9l6 6 6-6",
  copiar: "M8 8h12v12H8zM16 8V4H4v12h4",
  candado: "M6 11h12v10H6zM8 11V7a4 4 0 018 0v4",
  movil: "M8 2h8a1 1 0 011 1v18a1 1 0 01-1 1H8a1 1 0 01-1-1V3a1 1 0 011-1zM11 18h2",
  rayo: "M13 2L4 14h7l-1 8 9-12h-7l1-8z",
  cadena: "M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1",
  salir: "M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 17l-5-5 5-5M5 12h11",
  fuera: "M7 17L17 7M9 7h8v8",
  carpeta: "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z",
  sello: "M9 3h6v5l3 3v3H6v-3l3-3zM8 14h8v7H8z",
  mapa: "M9 3L3 6v15l6-3 6 3 6-3V3l-6 3-6-3zM9 3v15M15 6v15",
  reloj: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2",
};

export function Icono({ n, className, style }: { n: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
      <path d={ICONOS[n]} />
    </svg>
  );
}

export function Rueda({ className = "" }: { className?: string }) {
  return (
    <span
      className={className}
      style={{
        width: "1em", height: "1em", display: "inline-block", flex: "none",
        border: "2px solid currentColor", borderTopColor: "transparent",
        borderRadius: "50%", animation: "girar .7s linear infinite",
      }}
    />
  );
}

/** El menu. Dos bloques: donde se trabaja, y lo que se saca de ahi. */
const MENU = [
  {
    titulo: "Captación",
    entradas: [
      { href: "/", icono: "lupa", nombre: "Leads", pie: "webs analizadas" },
      { href: "/nuevos", icono: "sello", nombre: "Negocios nuevos", pie: "altas del registro" },
    ],
  },
];

export function Programa({
  titulo, sub, acciones, estado, children,
}: {
  titulo: string;
  sub?: string;
  acciones?: React.ReactNode;
  estado?: React.ReactNode;
  children: React.ReactNode;
}) {
  const ruta = usePathname();

  async function salir() {
    await fetch("/api/auth", { method: "DELETE" });
    window.location.href = "/login";
  }

  return (
    <div className="programa">
      <style>{"@keyframes girar{to{transform:rotate(360deg)}}"}</style>

      <nav className="lateral">
        <div className="marca">
          <i aria-label="Lweb" />
          <span className="txt">Lead Prospector</span>
        </div>

        <div className="pestanas">
          {MENU.map((g) => (
            <div className="grupo" key={g.titulo}>
              <span className="titulo">{g.titulo}</span>
              {g.entradas.map((e) => (
                <a key={e.href} href={e.href} aria-current={ruta === e.href ? "page" : undefined}>
                  <Icono n={e.icono} />
                  <span className="rot">
                    {e.nombre}
                    <small>{e.pie}</small>
                  </span>
                </a>
              ))}
            </div>
          ))}

          <div className="grupo">
            <span className="titulo">Datos</span>
            <a className="fuera" href="/api/leads/export">
              <Icono n="bajar" />
              <span className="rot">
                Exportar CSV
                <small>todos los leads</small>
              </span>
              <Icono n="fuera" className="salida" />
            </a>
          </div>
        </div>

        <div className="acciones-cuenta">
          <p className="quien">Sesión abierta</p>
          <button onClick={salir}>
            <Icono n="salir" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </nav>

      <div className="area">
        <div className="barra">
          <div className="titulo-barra">
            {titulo}
            {sub && <small>{sub}</small>}
          </div>
          {acciones && <div className="acciones">{acciones}</div>}
        </div>

        <div className="envoltura">{children}</div>

        <div className="barra-estado">{estado}</div>
      </div>
    </div>
  );
}
