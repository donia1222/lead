"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import { Programa, Icono, Rueda } from "@/components/programa";

interface Lead {
  id: string;
  name: string;
  sector: string;
  city: string;
  url: string;
  email: string;
  phone: string;
  contactPage: string;
  hasSSL: boolean;
  hasViewport: boolean;
  loadTime: number;
  score: number;
  problems: string[];
  status: "new" | "contacted" | "discarded";
  emailDraft: string;
  createdAt: string;
  enviadoEn?: string;
}

type Filter = "all" | "new" | "contacted" | "discarded" | "latest";

const SECTORS = [
  "restaurant", "coiffeur", "zahnarzt", "immobilien", "hotel",
  "autogarage", "anwalt", "bäckerei", "tierarzt", "metzgerei",
  "blumen", "fitnessstudio", "yoga", "physiotherapie", "optiker",
  "apotheke", "malerei", "elektriker", "sanitär", "schreinerei",
  "gärtnerei", "fahrschule", "reinigung", "fotograf", "massage",
  "kosmetik", "pizzeria", "café", "treuhand", "versicherung",
  "architektur", "transport", "tattoo", "schmuck", "möbel",
  "bauunternehmen", "dachdeckerei", "schlosserei", "druckerei",
  "webdesign", "steuerberater", "notar", "kindergarten",
];

const CITIES = [
  "Buchs SG", "Sevelen", "Grabs", "Gams", "Sennwald", "Haag",
  "Wartau", "Oberriet", "Rüthi", "Altstätten", "Marbach",
  "Rebstein", "Balgach", "Heerbrugg", "Berneck", "Au SG",
  "Diepoldsau", "Widnau", "Sargans", "Bad Ragaz", "Mels",
  "Flums", "Walenstadt", "Vaduz", "Schaan", "Triesen",
  "Balzers", "Eschen", "Mauren", "Triesenberg", "Feldkirch",
];

const QUICK_COMBOS = [
  ["restaurant", "Buchs SG"], ["coiffeur", "Sevelen"], ["zahnarzt", "Grabs"],
  ["autogarage", "Oberriet"], ["anwalt", "Vaduz"], ["elektriker", "Altstätten"],
];

const LANGS = ["de", "es", "en", "fr", "it"];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * La direccion, limpia. El raspado a veces se trae un caracter pegado al
 * final —«...@gmail.com\»— y asi el servidor de correo la rechaza. Se quita
 * aqui en vez de en la base: lo que hay guardado ya esta guardado.
 */
function limpiarEmail(x: string) {
  const e = (x || "").trim().replace(/^[<"'(\[]+/, "").replace(/[>"')\].,;:\\/]+$/, "");
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : "";
}

function splitDraft(draft: string) {
  const subjectMatch = draft.match(/^(?:Betreff|Asunto|Subject|Objet|Oggetto):\s*(.+)$/mi);
  const subject = subjectMatch ? subjectMatch[1].trim() : "Ihre Webseite";
  const body = subjectMatch ? draft.replace(subjectMatch[0], "").trim() : draft;
  return { subject, body };
}

export default function Home() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState({ done: 0, total: 0, label: "" });
  const [showEmail, setShowEmail] = useState<string | null>(null);
  const [emailContent, setEmailContent] = useState("");
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [showPromptFor, setShowPromptFor] = useState<string | null>(null);
  const [translating, setTranslating] = useState<string | null>(null);
  const [lastSearchIds, setLastSearchIds] = useState<Set<string>>(new Set());
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<"search" | "direct">("search");
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [enBloque, setEnBloque] = useState(false);
  const [toast, setToast] = useState<{ text: string; kind: "ok" | "error" } | null>(null);

  const [filter, setFilter] = useState<Filter>("all");
  const [sectorFilter, setSectorFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [textSearch, setTextSearch] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "score">("newest");
  const [search, setSearch] = useState({ sectors: [] as string[], cities: [] as string[] });
  const [sectorQuery, setSectorQuery] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [directAdd, setDirectAdd] = useState({ name: "", url: "", sector: "", city: "" });
  const [addingDirect, setAddingDirect] = useState(false);

  const loadLeads = useCallback(async () => {
    const res = await fetch("/api/leads");
    const data = await res.json();
    setLeads(Array.isArray(data) ? data : []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPanelOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.sectors.length === 0 || search.cities.length === 0) return;

    setSearching(true);
    const { sectors, cities } = search;
    const combos = sectors.flatMap((s) => cities.map((c) => ({ sector: s, city: c })));
    let totalLeads = 0;
    const newIds = new Set<string>();

    for (let i = 0; i < combos.length; i++) {
      const { sector, city } = combos[i];
      setSearchProgress({ done: i, total: combos.length, label: `${cap(sector)} en ${city}` });

      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: `${sector} ${city}`, sector, city }),
        });
        const data = await res.json();
        totalLeads += (data.leads?.length || 0);
        if (data.leads) {
          data.leads.forEach((l: Lead) => newIds.add(l.id));
        }
      } catch {
        // continue
      }
    }

    setLastSearchIds(newIds);
    if (newIds.size > 0) setFilter("latest");
    await loadLeads();
    setSearching(false);
    setSearchProgress({ done: 0, total: 0, label: "" });
    setToast({ text: `Búsqueda terminada: ${totalLeads} leads encontrados`, kind: "ok" });
    if (newIds.size > 0) setPanelOpen(false);
  }

  async function handleDirectAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!directAdd.name && !directAdd.url) return;

    setAddingDirect(true);

    try {
      let url = directAdd.url.trim();
      if (url && !url.startsWith("http")) url = "https://" + url;

      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: directAdd.name.trim(),
          url: url,
          sector: directAdd.sector,
          city: directAdd.city,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setToast({ text: "Error: " + data.error, kind: "error" });
      } else {
        setLastSearchIds(new Set([data.id]));
        setFilter("latest");
        setToast({ text: "Lead añadido correctamente", kind: "ok" });
        setDirectAdd({ name: "", url: "", sector: "", city: "" });
        await loadLeads();
        setPanelOpen(false);
      }
    } catch {
      setToast({ text: "Error al analizar la web", kind: "error" });
    }

    setAddingDirect(false);
  }

  function selectSearch(sector: string, city: string) {
    setSearch({ sectors: [sector], cities: [city] });
  }

  function toggle(list: "sectors" | "cities", value: string) {
    const current = search[list];
    const next = current.includes(value) ? current.filter((x) => x !== value) : [...current, value];
    setSearch({ ...search, [list]: next });
  }

  async function updateStatus(id: string, status: string) {
    await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await loadLeads();
  }

  async function removeLead(id: string) {
    setConfirmDelete(null);
    await fetch("/api/leads", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await loadLeads();
  }

  async function handleGenerateEmail(lead: Lead, prompt?: string) {
    setShowEmail(lead.id);
    setExpandedEmail(lead.id);
    setGeneratingEmail(true);
    setEmailContent("");
    setShowPromptFor(null);
    const res = await fetch("/api/generate-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: lead.id,
        name: lead.name,
        city: lead.city,
        sector: lead.sector,
        problems: lead.problems,
        customPrompt: prompt || undefined,
      }),
    });
    const data = await res.json();
    setEmailContent(data.email || data.error);
    setGeneratingEmail(false);
    setCustomPrompt("");
    await loadLeads();
  }

  async function handleTranslate(lead: Lead, lang: string) {
    setTranslating(lead.id);
    setShowEmail(lead.id);
    setExpandedEmail(lead.id);
    setEmailContent("");
    const res = await fetch("/api/translate-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lead.id, email: lead.emailDraft, lang }),
    });
    const data = await res.json();
    setEmailContent(data.email || data.error);
    setTranslating(null);
    await loadLeads();
  }

  /**
   * Mandar el email desde el servidor. Antes habia que copiar el borrador y
   * pegarlo en el programa de correo; ahora sale firmado por el dominio, con
   * copia oculta al buzon para que quede constancia.
   *
   * Pregunta antes a proposito: esto le llega a un negocio de verdad y no se
   * puede deshacer.
   */
  async function enviarEmail(lead: Lead, borrador: string) {
    const correo = limpiarEmail(lead.email);
    if (!correo) {
      setToast({ text: `La dirección de ${lead.name} no es válida: ${lead.email}`, kind: "error" });
      return;
    }
    const { subject, body } = splitDraft(borrador);
    if (!confirm(`¿Mandar el email a ${lead.name}?\n\n${correo}\nAsunto: ${subject}\n\nSale desde tu buzón y no se puede deshacer.`)) return;

    setEnviando(lead.id);
    try {
      const res = await fetch("/api/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, para: correo, nombre: lead.name, asunto: subject, texto: body }),
      });
      const data = await res.json();
      if (data.ok) {
        setToast({
          text: data.enEnviados
            ? `Email enviado a ${correo}`
            : `Email enviado a ${correo} — pero no se ha podido guardar en Enviados`,
          kind: "ok",
        });
        await loadLeads();
      } else {
        setToast({ text: data.error || "No se ha podido enviar", kind: "error" });
      }
    } catch {
      setToast({ text: "No se ha podido enviar", kind: "error" });
    }
    setEnviando(null);
  }

  function marcar(id: string, si: boolean) {
    setMarcados((p) => {
      const n = new Set(p);
      if (si) n.add(id); else n.delete(id);
      return n;
    });
  }

  /**
   * Lo marcado, de golpe. Va en una sola llamada y no en una por lead: con
   * diez marcados eran diez viajes al almacen, y si fallaba el quinto te
   * quedabas sin saber cuales se habian hecho.
   */
  async function enBloqueHacer(que: "descartar" | "recuperar" | "borrar") {
    const ids = [...marcados];
    if (!ids.length) return;
    if (que === "borrar" && !confirm(`¿Eliminar ${ids.length} ${ids.length === 1 ? "lead" : "leads"}?\n\nEsto no se puede deshacer. Si solo quieres quitarlos de en medio, usa Descartar.`)) return;

    setEnBloque(true);
    try {
      const res = await fetch("/api/leads", {
        method: que === "borrar" ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(que === "borrar" ? { ids } : { ids, status: que === "descartar" ? "discarded" : "new" }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "");
      const n = data.borrados ?? data.cambiados ?? ids.length;
      setToast({
        text: que === "borrar" ? `${n} ${n === 1 ? "lead eliminado" : "leads eliminados"}`
            : que === "descartar" ? `${n} ${n === 1 ? "descartado" : "descartados"}`
            : `${n} ${n === 1 ? "recuperado" : "recuperados"}`,
        kind: "ok",
      });
      setMarcados(new Set());
      await loadLeads();
    } catch {
      setToast({ text: "No se ha podido hacer", kind: "error" });
    }
    setEnBloque(false);
  }

  async function copyDraft(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setToast({ text: "No se pudo copiar", kind: "error" });
    }
  }

  const sectors = [...new Set(leads.map((l) => l.sector).filter(Boolean))].sort();
  const cities = [...new Set(leads.map((l) => l.city).filter(Boolean))].sort();

  const filtered = leads
    .filter((l) => {
      if (filter === "latest") {
        if (!lastSearchIds.has(l.id)) return false;
      } else if (filter === "all") {
        if (l.status === "discarded") return false;
      } else if (l.status !== filter) return false;
      if (sectorFilter && l.sector !== sectorFilter) return false;
      if (cityFilter && l.city !== cityFilter) return false;
      if (textSearch) {
        const q = textSearch.toLowerCase();
        return (
          l.name.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          l.url.toLowerCase().includes(q) ||
          l.sector.toLowerCase().includes(q) ||
          l.city.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "score") return b.score - a.score;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const tabs: { f: Filter; label: string; count: number }[] = [
    ...(lastSearchIds.size > 0 ? [{ f: "latest" as const, label: "Última búsqueda", count: lastSearchIds.size }] : []),
    { f: "all", label: "Activos", count: leads.filter((l) => l.status !== "discarded").length },
    { f: "new", label: "Nuevos", count: leads.filter((l) => l.status === "new").length },
    { f: "contacted", label: "Contactados", count: leads.filter((l) => l.status === "contacted").length },
    { f: "discarded", label: "Descartados", count: leads.filter((l) => l.status === "discarded").length },
  ];

  const hasFilters = Boolean(sectorFilter || cityFilter || textSearch);
  // Marcar «todos» marca lo que se esta viendo, no los 300 que hay guardados.
  const visiblesMarcados = filtered.filter((l) => marcados.has(l.id)).length;
  const todosMarcados = filtered.length > 0 && visiblesMarcados === filtered.length;
  const combos = search.sectors.length * search.cities.length;
  const progressPct = searchProgress.total ? Math.round((searchProgress.done / searchProgress.total) * 100) : 0;
  const sinEmail = leads.filter((l) => l.status !== "discarded" && !l.email).length;

  return (
    <Programa
      titulo="Leads"
      sub={`${leads.length} negocios guardados`}
      acciones={
        <>
          {searching && !panelOpen && (
            <button className="btn claro chico" onClick={() => setPanelOpen(true)}>
              <Rueda /> Buscando {searchProgress.done + 1}/{searchProgress.total}
            </button>
          )}
          <button className="btn" onClick={() => setPanelOpen(true)}>
            <Icono n="mas" /> Buscar leads
          </button>
        </>
      }
      estado={
        <>
          <span className="estado">
            <i className={`punto ${searching ? "trabajando" : loaded ? "si" : ""}`} />
            {searching ? searchProgress.label || "Buscando…" : loaded ? "Datos al día" : "Cargando…"}
          </span>
          <span className="estado">
            <span className="cifra">{filtered.length}</span> en pantalla
          </span>
          {sinEmail > 0 && (
            <span className="estado">
              <span className="cifra">{sinEmail}</span> sin email
            </span>
          )}
          <span className="derecha">Lweb · Lead Prospector</span>
        </>
      }
    >
      {/* Filtros de estado y herramientas de busqueda */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <div className="filtros">
          {tabs.map((t) => (
            <button key={t.f} onClick={() => setFilter(t.f)} aria-selected={filter === t.f}>
              {t.label} <b>{t.count}</b>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <input
          placeholder="Buscar por nombre, email, web…"
          value={textSearch}
          onChange={(e) => setTextSearch(e.target.value)}
          style={{ flex: "1 1 240px", width: "auto" }}
        />
        <select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)} style={{ width: "auto" }}>
          <option value="">Todos los sectores</option>
          {sectors.map((s) => (
            <option key={s} value={s}>{cap(s)} ({leads.filter((l) => l.sector === s).length})</option>
          ))}
        </select>
        <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} style={{ width: "auto" }}>
          <option value="">Todas las ciudades</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c} ({leads.filter((l) => l.city === c).length})</option>
          ))}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "newest" | "score")} style={{ width: "auto" }}>
          <option value="newest">Más recientes</option>
          <option value="score">Mayor oportunidad</option>
        </select>
        {hasFilters && (
          <button className="btn plano" onClick={() => { setSectorFilter(""); setCityFilter(""); setTextSearch(""); }}>
            <Icono n="x" /> Limpiar
          </button>
        )}
      </div>

      {marcados.size > 0 && (
        <div className="marcados">
          <b className="cifra">{marcados.size}</b>
          <span>{marcados.size === 1 ? "marcado" : "marcados"}</span>
          <span style={{ flex: 1 }} />
          <button className="btn claro chico" onClick={() => enBloqueHacer("descartar")} disabled={enBloque}>
            <Icono n="caja" /> Descartar
          </button>
          <button className="btn claro chico" onClick={() => enBloqueHacer("recuperar")} disabled={enBloque}>
            <Icono n="volver" /> Recuperar
          </button>
          <button className="btn peligro firme chico" onClick={() => enBloqueHacer("borrar")} disabled={enBloque}>
            {enBloque ? <Rueda /> : <Icono n="papelera" />} Eliminar
          </button>
          <button className="btn plano" onClick={() => setMarcados(new Set())}>
            <Icono n="x" /> Quitar
          </button>
        </div>
      )}

      {loaded && filtered.length === 0 ? (
        <div className="vacio">
          <b>{leads.length === 0 ? "Todavía no hay leads" : "Ningún lead con estos filtros"}</b>
          {leads.length === 0
            ? "Busca negocios por sector y pueblo, o añade una web a mano."
            : "Prueba a cambiar los filtros o la pestaña."}
          <div style={{ marginTop: 14 }}>
            {leads.length === 0 ? (
              <button className="btn" onClick={() => setPanelOpen(true)}><Icono n="lupa" /> Buscar leads</button>
            ) : hasFilters ? (
              <button className="btn claro chico" onClick={() => { setSectorFilter(""); setCityFilter(""); setTextSearch(""); }}>
                Limpiar filtros
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="tabla"><table className="lista">
          <thead>
            <tr>
              <th style={{ width: 34 }}>
                <input
                  type="checkbox"
                  checked={todosMarcados}
                  ref={(e) => { if (e) e.indeterminate = visiblesMarcados > 0 && !todosMarcados; }}
                  onChange={(e) => {
                    const n = new Set(marcados);
                    filtered.forEach((l) => (e.target.checked ? n.add(l.id) : n.delete(l.id)));
                    setMarcados(n);
                  }}
                  title="Marcar todos los que se ven"
                />
              </th>
              <th style={{ width: 54 }}>Punt.</th>
              <th>Negocio</th>
              <th className="op" style={{ width: 190 }}>Web</th>
              <th style={{ width: 210 }}>Contacto</th>
              <th className="op" style={{ width: 170 }}>Chequeo</th>
              <th style={{ width: 150 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead) => {
              const isOpen = expandedEmail === lead.id;
              const draft = showEmail === lead.id && emailContent ? emailContent : lead.emailDraft;
              const busy = (generatingEmail && showEmail === lead.id) || translating === lead.id;
              const href = lead.url.startsWith("http") ? lead.url : "https://" + lead.url;
              const punt = lead.score >= 50 ? "alta" : lead.score >= 25 ? "media" : "baja";
              const correo = limpiarEmail(lead.email);
              const envio = correo && draft ? splitDraft(draft) : null;
              const escribiendo = generatingEmail && showEmail === lead.id;

              return (
                <Fragment key={lead.id}>
                  <tr
                    className={`fila${lead.status === "discarded" ? " apagada" : ""}${isOpen ? " abierta" : ""}`}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={marcados.has(lead.id)}
                        onChange={(e) => marcar(lead.id, e.target.checked)}
                        aria-label={`Marcar ${lead.name}`}
                      />
                    </td>
                    <td>
                      <span className={`punt ${punt}`} title="Puntuación de oportunidad">
                        <b>{lead.score}</b>
                        <small>pts</small>
                      </span>
                    </td>
                    <td>
                      <div className="nombre">{lead.name}</div>
                      <div className="donde">
                        {[lead.sector && cap(lead.sector), lead.city].filter(Boolean).join(" · ")}
                        {lead.status === "contacted" && (lead.enviadoEn
                          ? ` · email enviado el ${new Date(lead.enviadoEn).toLocaleDateString("es-ES")}`
                          : " · contactado")}
                        {lead.status === "discarded" && " · descartado"}
                      </div>
                    </td>
                    <td className="op">
                      <a href={href} target="_blank" rel="noreferrer" className="mono">
                        {lead.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                      </a>
                      {lead.contactPage && (
                        <div style={{ marginTop: 2 }}>
                          <a href={lead.contactPage} target="_blank" rel="noreferrer"
                            style={{ fontSize: 12, color: "var(--suave)" }}>
                            página de contacto
                          </a>
                        </div>
                      )}
                    </td>
                    <td>
                      {correo ? (
                        <a href={`mailto:${correo}`} className="mono">{correo}</a>
                      ) : lead.email ? (
                        <span className="eti aviso" title={lead.email}><Icono n="sobre" /> email con fallo</span>
                      ) : (
                        <span className="eti mal"><Icono n="sobre" /> sin email</span>
                      )}
                      {lead.phone && (
                        <div className="mono" style={{ marginTop: 2 }}>
                          <a href={`tel:${lead.phone}`}>{lead.phone}</a>
                        </div>
                      )}
                    </td>
                    <td className="op">
                      <div className="etiquetas">
                        <span className={`eti ${lead.hasSSL ? "ok" : "mal"}`}>
                          <Icono n="candado" /> {lead.hasSSL ? "SSL" : "sin SSL"}
                        </span>
                        <span className={`eti ${lead.hasViewport ? "ok" : "mal"}`}>
                          <Icono n="movil" /> {lead.hasViewport ? "móvil" : "no móvil"}
                        </span>
                        <span className="eti gris"><Icono n="rayo" /> {lead.loadTime} ms</span>
                        {lead.problems.length > 0 && (
                          <span className="eti aviso">{lead.problems.length} {lead.problems.length === 1 ? "aviso" : "avisos"}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="acciones">
                        {envio ? (
                          <button
                            className="btn chico"
                            onClick={() => enviarEmail(lead, draft)}
                            disabled={enviando === lead.id}
                            title="Mandar el email desde tu buzón"
                          >
                            {enviando === lead.id ? <Rueda /> : <Icono n="enviar" />}
                            {enviando === lead.id ? "Enviando…" : "Enviar"}
                          </button>
                        ) : correo ? (
                          /* Hay a quien escribir pero todavia no hay carta:
                             antes aqui no habia nada y parecia que el lead no
                             servia. Se escribe y el boton pasa a «Enviar». */
                          <button
                            className="btn claro chico"
                            onClick={() => handleGenerateEmail(lead)}
                            disabled={escribiendo}
                            title="Escribir el email con la IA"
                          >
                            {escribiendo ? <Rueda /> : <Icono n="chispas" />}
                            {escribiendo ? "Escribiendo…" : "Escribir"}
                          </button>
                        ) : lead.phone ? (
                          /* Sin direccion no hay email que mandar: lo que queda
                             es llamar, asi que eso es lo que ofrece. */
                          <a className="btn claro chico" href={`tel:${lead.phone}`} title="Llamar">
                            <Icono n="tel" /> Llamar
                          </a>
                        ) : null}
                        <button
                          className="btn plano"
                          onClick={() => setExpandedEmail(isOpen ? null : lead.id)}
                          title={isOpen ? "Cerrar" : "Abrir la ficha"}
                        >
                          <Icono n="flecha" className={isOpen ? "girado" : ""}
                            style={{ transform: isOpen ? "rotate(180deg)" : undefined, transition: "transform .15s" }} />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {isOpen && (
                    <tr className="detalle">
                      <td colSpan={7}>
                        {lead.problems.length > 0 && (
                          <div className="etiquetas" style={{ marginBottom: 12 }}>
                            {lead.problems.map((p, i) => (
                              <span key={i} className="eti aviso">{p}</span>
                            ))}
                          </div>
                        )}

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
                          <button className="btn claro chico" onClick={() => handleGenerateEmail(lead)} disabled={busy}>
                            <Icono n="rehacer" /> {lead.emailDraft ? "Regenerar email" : "Generar email"}
                          </button>
                          <button
                            className="btn plano"
                            onClick={() => { setShowPromptFor(showPromptFor === lead.id ? null : lead.id); setCustomPrompt(""); }}
                          >
                            <Icono n="chispas" /> Personalizar
                          </button>
                          {envio && (
                            <a
                              className="btn plano"
                              href={`mailto:${correo}?subject=${encodeURIComponent(envio.subject)}&body=${encodeURIComponent(envio.body)}`}
                              title="Abrirlo en tu programa de correo en vez de mandarlo desde aquí"
                            >
                              <Icono n="sobre" /> Abrir en mi correo
                            </a>
                          )}
                          <span style={{ flex: 1 }} />
                          {lead.status !== "contacted" && (
                            <button className="btn plano" onClick={() => updateStatus(lead.id, "contacted")}>
                              <Icono n="visto" /> Contactado
                            </button>
                          )}
                          {lead.status !== "discarded" ? (
                            <button className="btn plano" onClick={() => updateStatus(lead.id, "discarded")}>
                              <Icono n="caja" /> Descartar
                            </button>
                          ) : (
                            <button className="btn plano" onClick={() => updateStatus(lead.id, "new")}>
                              <Icono n="volver" /> Recuperar
                            </button>
                          )}
                          {confirmDelete === lead.id ? (
                            <button className="btn peligro firme chico" onClick={() => removeLead(lead.id)}
                              onBlur={() => setConfirmDelete(null)} autoFocus>
                              <Icono n="papelera" /> ¿Eliminar?
                            </button>
                          ) : (
                            <button className="btn peligro" onClick={() => setConfirmDelete(lead.id)} title="Eliminar">
                              <Icono n="papelera" />
                            </button>
                          )}
                        </div>

                        {showPromptFor === lead.id && (
                          <div className="tarjeta" style={{ marginBottom: 12 }}>
                            <label>Instrucciones para la IA</label>
                            <p style={{ fontSize: 12, color: "var(--suave)", margin: "0 0 7px" }}>
                              Ej: «enfócate en reservas online», «tono más directo»
                            </p>
                            <textarea
                              value={customPrompt}
                              onChange={(e) => setCustomPrompt(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && customPrompt.trim()) handleGenerateEmail(lead, customPrompt);
                              }}
                              placeholder="Escribe tus instrucciones…"
                              rows={2}
                              autoFocus
                            />
                            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                              <button className="btn chico" onClick={() => handleGenerateEmail(lead, customPrompt)}
                                disabled={!customPrompt.trim() || generatingEmail}>
                                <Icono n="chispas" /> Generar
                              </button>
                              <button className="btn plano" onClick={() => { setShowPromptFor(null); setCustomPrompt(""); }}>
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}

                        {(lead.emailDraft || busy) && (
                          <div className="borrador">
                            <div className="arriba">
                              <span style={{ fontSize: 12, color: "var(--suave)" }}>Idioma</span>
                              <div className="idiomas">
                                {LANGS.map((code) => (
                                  <button key={code} onClick={() => handleTranslate(lead, code)} disabled={busy}>
                                    {code}
                                  </button>
                                ))}
                              </div>
                              <span style={{ flex: 1 }} />
                              <button className="btn plano" onClick={() => copyDraft(lead.id, draft)} disabled={busy || !draft}>
                                <Icono n={copied === lead.id ? "visto" : "copiar"} />
                                {copied === lead.id ? "Copiado" : "Copiar"}
                              </button>
                            </div>
                            {busy ? (
                              <p style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 16px", margin: 0, fontSize: 13.5, color: "var(--suave)" }}>
                                <Rueda /> {translating === lead.id ? "Traduciendo…" : "Escribiendo el email con la IA…"}
                              </p>
                            ) : (
                              <pre>{draft}</pre>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table></div>
      )}

      {/* El cajon de buscar leads */}
      {panelOpen && (
        <>
          <div className="velo" onClick={() => setPanelOpen(false)} />
          <aside className="cajon">
            <div className="arriba">
              Buscar leads
              <button className="cerrar" onClick={() => setPanelOpen(false)} aria-label="Cerrar">
                <Icono n="x" />
              </button>
            </div>

            <div style={{ padding: "12px 16px 0" }}>
              <div className="filtros">
                {([["search", "Por zona"], ["direct", "Una web a mano"]] as const).map(([k, label]) => (
                  <button key={k} onClick={() => setPanelTab(k)} aria-selected={panelTab === k} style={{ flex: 1, justifyContent: "center" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {panelTab === "search" ? (
              <form onSubmit={handleSearch} style={{ display: "contents" }}>
                <div className="cuerpo">
                  <div className="apartado">
                    <div className="cab"><span className="nom">Búsquedas rápidas</span></div>
                    <div className="fichas" style={{ maxHeight: "none" }}>
                      {QUICK_COMBOS.map(([s, c]) => (
                        <button key={`${s}-${c}`} type="button" onClick={() => selectSearch(s, c)}>
                          {cap(s)} · {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  {([
                    { key: "sectors" as const, title: "1 · Sectores", all: SECTORS, q: sectorQuery, setQ: setSectorQuery, fmt: cap },
                    { key: "cities" as const, title: "2 · Pueblos", all: CITIES, q: cityQuery, setQ: setCityQuery, fmt: (x: string) => x },
                  ]).map(({ key, title, all, q, setQ, fmt }) => {
                    const selected = search[key];
                    const visible = all.filter((x) => x.toLowerCase().includes(q.toLowerCase()));
                    return (
                      <div className="apartado" key={key}>
                        <div className="cab">
                          <span className="nom">
                            {title}
                            {selected.length > 0 && <b>{selected.length}</b>}
                          </span>
                          <span className="enlaces">
                            <button type="button" onClick={() => setSearch({ ...search, [key]: [...all] })}>Todos</button>
                            <button type="button" onClick={() => setSearch({ ...search, [key]: [] })}>Ninguno</button>
                          </span>
                        </div>
                        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar…" style={{ marginBottom: 7 }} />
                        <div className="fichas">
                          {visible.map((x) => {
                            const on = selected.includes(x);
                            return (
                              <button key={x} type="button" aria-pressed={on} onClick={() => toggle(key, x)}>
                                {on && <Icono n="visto" />}
                                {fmt(x)}
                              </button>
                            );
                          })}
                          {visible.length === 0 && <p style={{ fontSize: 13, color: "var(--suave)", margin: 4 }}>Sin resultados</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pie">
                  {searching ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 7 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                          <Rueda /> {searchProgress.label}
                        </span>
                        <span className="cifra" style={{ color: "var(--suave)" }}>
                          {searchProgress.done + 1}/{searchProgress.total}
                        </span>
                      </div>
                      <div className="progreso"><i style={{ width: `${Math.max(progressPct, 4)}%` }} /></div>
                      <p style={{ fontSize: 12, color: "var(--suave)", margin: "8px 0 0" }}>
                        Mira local.ch, analiza cada web y escribe el email. Puedes cerrar esto mientras tanto.
                      </p>
                    </>
                  ) : (
                    <button type="submit" className="btn" disabled={combos === 0} style={{ width: "100%", justifyContent: "center" }}>
                      <Icono n="lupa" />
                      {combos === 0
                        ? "Elige al menos un sector y un pueblo"
                        : `Buscar ${combos} ${combos === 1 ? "combinación" : "combinaciones"}`}
                    </button>
                  )}
                </div>
              </form>
            ) : (
              <form onSubmit={handleDirectAdd} style={{ display: "contents" }}>
                <div className="cuerpo">
                  <p style={{ fontSize: 13, color: "var(--suave)", margin: "0 0 14px" }}>
                    Pon una web y se analiza igual que en la búsqueda: SSL, móvil, velocidad y SEO, y se escribe el email.
                  </p>
                  <div className="apartado">
                    <label>Nombre del negocio</label>
                    <input value={directAdd.name} onChange={(e) => setDirectAdd({ ...directAdd, name: e.target.value })}
                      placeholder="Ej: Restaurant Löwen" required />
                  </div>
                  <div className="apartado">
                    <label>Web</label>
                    <input value={directAdd.url} onChange={(e) => setDirectAdd({ ...directAdd, url: e.target.value })}
                      placeholder="Ej: www.restaurant-loewen.ch" required />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label>Sector <span style={{ color: "var(--suave)" }}>(opcional)</span></label>
                      <select value={directAdd.sector} onChange={(e) => setDirectAdd({ ...directAdd, sector: e.target.value })}>
                        <option value="">Seleccionar…</option>
                        {SECTORS.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label>Pueblo <span style={{ color: "var(--suave)" }}>(opcional)</span></label>
                      <select value={directAdd.city} onChange={(e) => setDirectAdd({ ...directAdd, city: e.target.value })}>
                        <option value="">Seleccionar…</option>
                        {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="pie">
                  <button type="submit" className="btn" style={{ width: "100%", justifyContent: "center" }}
                    disabled={addingDirect || (!directAdd.name && !directAdd.url)}>
                    {addingDirect ? <><Rueda /> Analizando la web…</> : <><Icono n="chispas" /> Analizar y escribir email</>}
                  </button>
                </div>
              </form>
            )}
          </aside>
        </>
      )}

      {toast && (
        <div className={`notificacion${toast.kind === "error" ? " error" : ""}`}>
          <Icono n={toast.kind === "ok" ? "visto" : "x"} />
          <span style={{ flex: 1 }}>{toast.text}</span>
          <button onClick={() => setToast(null)} aria-label="Cerrar"><Icono n="x" /></button>
        </div>
      )}
    </Programa>
  );
}
