"use client";

import { useState, useEffect, useCallback } from "react";

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

const ICONS: Record<string, string> = {
  plus: "M12 5v14M5 12h14",
  x: "M6 6l12 12M18 6L6 18",
  search: "M21 21l-4.3-4.3M11 18a7 7 0 100-14 7 7 0 000 14z",
  download: "M12 4v12m0 0l-4-4m4 4l4-4M4 20h16",
  globe: "M12 21a9 9 0 100-18 9 9 0 000 18zM3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z",
  send: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  refresh: "M4 4v5h5M20 20v-5h-5M5.5 15a7 7 0 0012.4 2M18.5 9A7 7 0 006.1 7",
  sparkles: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z",
  check: "M5 13l4 4L19 7",
  archive: "M4 7h16M5 7l1 13h12l1-13M9 4h6M10 11v5M14 11v5",
  undo: "M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3",
  trash: "M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3",
  chevron: "M6 9l6 6 6-6",
  copy: "M8 8h12v12H8zM16 8V4H4v12h4",
  lock: "M6 11h12v10H6zM8 11V7a4 4 0 018 0v4",
  mobile: "M8 2h8a1 1 0 011 1v18a1 1 0 01-1 1H8a1 1 0 01-1-1V3a1 1 0 011-1zM11 18h2",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7l1-8z",
  link: "M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1",
  logout: "M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 17l-5-5 5-5M5 12h11",
};

function Icon({ name, className = "w-4 h-4" }: { name: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  );
}

function Spinner({ className = "w-4 h-4" }: { className?: string }) {
  return <span className={`${className} inline-block border-2 border-current border-t-transparent rounded-full animate-spin`} />;
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

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    window.location.href = "/login";
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

  const hasFilters = sectorFilter || cityFilter || textSearch;
  const combos = search.sectors.length * search.cities.length;
  const progressPct = searchProgress.total ? Math.round((searchProgress.done / searchProgress.total) * 100) : 0;

  const inputCls = "w-full bg-white border border-slate-200 px-3.5 py-2.5 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition";
  const selectCls = "bg-white border border-slate-200 pl-3 pr-8 py-2 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white grid place-items-center font-bold shadow-sm">L</div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-tight">Lead Prospector</h1>
              <p className="text-xs text-slate-500">{leads.length} leads guardados</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {searching && !panelOpen && (
              <button
                onClick={() => setPanelOpen(true)}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium"
              >
                <Spinner className="w-3 h-3" />
                Buscando {searchProgress.done + 1}/{searchProgress.total}
              </button>
            )}
            <a
              href="/nuevos"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
              title="Negocios recién inscritos en el registro"
            >
              <span className="hidden sm:inline">Negocios nuevos</span>
              <span className="sm:hidden">Nuevos</span>
            </a>
            <a
              href="/api/leads/export"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
              title="Exportar CSV"
            >
              <Icon name="download" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </a>
            <button
              onClick={() => setPanelOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 shadow-sm transition"
            >
              <Icon name="plus" />
              <span>Nuevos leads</span>
            </button>
            <button
              onClick={logout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
            >
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Status tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 mb-4 -mx-1 px-1">
          {tabs.map((t) => (
            <button
              key={t.f}
              onClick={() => setFilter(t.f)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                filter === t.f
                  ? t.f === "latest"
                    ? "bg-amber-500 text-white shadow-sm"
                    : "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-white hover:shadow-sm"
              }`}
            >
              {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${filter === t.f ? "bg-white/20" : "bg-slate-200 text-slate-600"}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <div className="relative flex-1 min-w-[220px]">
            <Icon name="search" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Buscar por nombre, email, web..."
              value={textSearch}
              onChange={(e) => setTextSearch(e.target.value)}
              className={`${inputCls} pl-9 py-2`}
            />
          </div>
          <select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)} className={selectCls}>
            <option value="">Todos los sectores</option>
            {sectors.map((s) => (
              <option key={s} value={s}>{cap(s)} ({leads.filter((l) => l.sector === s).length})</option>
            ))}
          </select>
          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className={selectCls}>
            <option value="">Todas las ciudades</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c} ({leads.filter((l) => l.city === c).length})</option>
            ))}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "newest" | "score")} className={selectCls}>
            <option value="newest">Más recientes</option>
            <option value="score">Mayor oportunidad</option>
          </select>
          {hasFilters && (
            <button
              onClick={() => { setSectorFilter(""); setCityFilter(""); setTextSearch(""); }}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 px-2 py-2 transition"
            >
              <Icon name="x" className="w-3.5 h-3.5" /> Limpiar
            </button>
          )}
        </div>

        <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-3">
          {filtered.length} {filtered.length === 1 ? "lead" : "leads"}
        </p>

        {/* Leads */}
        <div className="space-y-3">
          {filtered.map((lead) => {
            const isOpen = expandedEmail === lead.id;
            const draft = showEmail === lead.id && emailContent ? emailContent : lead.emailDraft;
            const busy = (generatingEmail && showEmail === lead.id) || translating === lead.id;
            const href = lead.url.startsWith("http") ? lead.url : "https://" + lead.url;
            const scoreCls =
              lead.score >= 50 ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : lead.score >= 25 ? "bg-amber-50 text-amber-700 ring-amber-200"
              : "bg-rose-50 text-rose-600 ring-rose-200";

            return (
              <article
                key={lead.id}
                className={`bg-white rounded-2xl border shadow-sm transition hover:shadow-md ${
                  lead.status === "contacted" ? "border-emerald-200"
                  : lead.status === "discarded" ? "border-slate-200 opacity-60 hover:opacity-100"
                  : "border-slate-200"
                }`}
              >
                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-4">
                    {/* Score */}
                    <div className={`w-14 h-14 rounded-xl ring-1 flex flex-col items-center justify-center flex-shrink-0 ${scoreCls}`} title="Puntuación de oportunidad">
                      <span className="text-lg font-bold leading-none">{lead.score}</span>
                      <span className="text-[10px] font-medium mt-0.5 opacity-80">score</span>
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h3 className="text-base sm:text-lg font-semibold text-slate-900 truncate">{lead.name}</h3>
                        {lead.status === "contacted" && (
                          <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                            <Icon name="check" className="w-3 h-3" /> Contactado
                          </span>
                        )}
                        {lead.status === "discarded" && (
                          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">Descartado</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {[lead.sector && cap(lead.sector), lead.city].filter(Boolean).join(" · ")}
                      </p>

                      {/* Contact */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm">
                        <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-indigo-600 hover:underline max-w-[260px]">
                          <Icon name="globe" className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{lead.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</span>
                        </a>
                        {lead.email ? (
                          <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 text-slate-700 hover:underline">
                            <Icon name="mail" className="w-3.5 h-3.5 text-slate-400" />
                            {lead.email}
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-rose-500">
                            <Icon name="mail" className="w-3.5 h-3.5" /> Sin email
                          </span>
                        )}
                        {lead.phone && (
                          <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1.5 text-slate-700 hover:underline">
                            <Icon name="phone" className="w-3.5 h-3.5 text-slate-400" />
                            {lead.phone}
                          </a>
                        )}
                        {lead.contactPage && (
                          <a href={lead.contactPage} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-slate-500 hover:underline">
                            <Icon name="link" className="w-3.5 h-3.5 text-slate-400" /> Contacto
                          </a>
                        )}
                      </div>

                      {/* Checks + problems */}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md ${lead.hasSSL ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>
                          <Icon name="lock" className="w-3 h-3" /> {lead.hasSSL ? "SSL" : "Sin SSL"}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md ${lead.hasViewport ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>
                          <Icon name="mobile" className="w-3 h-3" /> {lead.hasViewport ? "Mobile OK" : "No mobile"}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          <Icon name="bolt" className="w-3 h-3" /> {lead.loadTime}ms
                        </span>
                        {lead.problems.map((p, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-100">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Primary action (desktop) */}
                    <div className="hidden md:flex flex-col items-end gap-2 flex-shrink-0">
                      {lead.email && draft && (() => {
                        const { subject, body } = splitDraft(draft);
                        return (
                          <a
                            href={`mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition"
                          >
                            <Icon name="send" /> Enviar email
                          </a>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Action bar */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-3 border-t border-slate-100">
                    {lead.email && draft && (() => {
                      const { subject, body } = splitDraft(draft);
                      return (
                        <a
                          href={`mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
                          className="md:hidden inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium"
                        >
                          <Icon name="send" className="w-3.5 h-3.5" /> Enviar
                        </a>
                      );
                    })()}
                    {lead.emailDraft && (
                      <button
                        onClick={() => setExpandedEmail(isOpen ? null : lead.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                          isOpen ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <Icon name="mail" className="w-3.5 h-3.5" />
                        {isOpen ? "Ocultar borrador" : "Ver borrador"}
                        <Icon name="chevron" className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                    )}
                    <button
                      onClick={() => handleGenerateEmail(lead)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition"
                    >
                      <Icon name="refresh" className="w-3.5 h-3.5" /> {lead.emailDraft ? "Regenerar" : "Generar email"}
                    </button>
                    <button
                      onClick={() => {
                        setShowPromptFor(showPromptFor === lead.id ? null : lead.id);
                        setCustomPrompt("");
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition ${
                        showPromptFor === lead.id ? "bg-violet-50 text-violet-700" : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <Icon name="sparkles" className="w-3.5 h-3.5" /> Personalizar
                    </button>

                    <div className="flex items-center gap-1 ml-auto">
                      {lead.status !== "contacted" && (
                        <button
                          onClick={() => updateStatus(lead.id, "contacted")}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition"
                        >
                          <Icon name="check" className="w-3.5 h-3.5" /> Contactado
                        </button>
                      )}
                      {lead.status !== "discarded" ? (
                        <button
                          onClick={() => updateStatus(lead.id, "discarded")}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:bg-slate-100 transition"
                        >
                          <Icon name="archive" className="w-3.5 h-3.5" /> Descartar
                        </button>
                      ) : (
                        <button
                          onClick={() => updateStatus(lead.id, "new")}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition"
                        >
                          <Icon name="undo" className="w-3.5 h-3.5" /> Restaurar
                        </button>
                      )}
                      {confirmDelete === lead.id ? (
                        <button
                          onClick={() => removeLead(lead.id)}
                          onBlur={() => setConfirmDelete(null)}
                          autoFocus
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-rose-600 text-white hover:bg-rose-700 transition"
                        >
                          <Icon name="trash" className="w-3.5 h-3.5" /> ¿Eliminar?
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(lead.id)}
                          title="Eliminar"
                          className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                        >
                          <Icon name="trash" className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Custom prompt */}
                  {showPromptFor === lead.id && (
                    <div className="mt-3 bg-violet-50/60 rounded-xl p-4 border border-violet-100">
                      <label className="text-sm font-medium text-slate-700">Instrucciones para la IA</label>
                      <p className="text-xs text-slate-500 mb-2">Ej: &quot;enfócate en reservas online&quot;, &quot;tono más directo&quot;</p>
                      <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && customPrompt.trim()) handleGenerateEmail(lead, customPrompt);
                        }}
                        placeholder="Escribe tus instrucciones..."
                        className={`${inputCls} resize-none`}
                        rows={2}
                        autoFocus
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleGenerateEmail(lead, customPrompt)}
                          disabled={!customPrompt.trim() || generatingEmail}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-40 transition"
                        >
                          <Icon name="sparkles" className="w-3.5 h-3.5" /> Generar
                        </button>
                        <button
                          onClick={() => { setShowPromptFor(null); setCustomPrompt(""); }}
                          className="px-4 py-2 text-slate-600 rounded-lg text-sm hover:bg-white transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Email draft */}
                  {isOpen && (lead.emailDraft || busy) && (
                    <div className="mt-3 rounded-xl border border-slate-200 overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-500 mr-1">Idioma</span>
                          <div className="flex bg-white border border-slate-200 rounded-lg p-0.5">
                            {LANGS.map((code) => (
                              <button
                                key={code}
                                onClick={() => handleTranslate(lead, code)}
                                disabled={busy}
                                className="px-2 py-0.5 rounded-md text-xs font-medium uppercase text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition"
                              >
                                {code}
                              </button>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => copyDraft(lead.id, draft)}
                          disabled={busy || !draft}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-600 hover:bg-white disabled:opacity-40 transition"
                        >
                          <Icon name={copied === lead.id ? "check" : "copy"} className="w-3.5 h-3.5" />
                          {copied === lead.id ? "Copiado" : "Copiar"}
                        </button>
                      </div>
                      {busy ? (
                        <div className="flex items-center gap-3 px-4 py-6 text-sm text-slate-500">
                          <Spinner className="w-4 h-4 text-indigo-500" />
                          {translating === lead.id ? "Traduciendo..." : "Generando email con IA..."}
                        </div>
                      ) : (
                        <pre className="px-4 py-4 text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed bg-white">
                          {draft}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}

          {loaded && filtered.length === 0 && (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
              <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 grid place-items-center mx-auto mb-4">
                <Icon name="search" className="w-5 h-5" />
              </div>
              <p className="text-lg font-semibold text-slate-800">
                {leads.length === 0 ? "Todavía no tienes leads" : "Ningún lead con estos filtros"}
              </p>
              <p className="text-sm text-slate-500 mt-1 mb-5">
                {leads.length === 0 ? "Busca empresas por sector y ciudad, o añade una web directamente." : "Prueba a cambiar los filtros o la pestaña."}
              </p>
              {leads.length === 0 ? (
                <button
                  onClick={() => setPanelOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition"
                >
                  <Icon name="plus" /> Buscar leads
                </button>
              ) : hasFilters ? (
                <button
                  onClick={() => { setSectorFilter(""); setCityFilter(""); setTextSearch(""); }}
                  className="text-sm font-medium text-indigo-600 hover:underline"
                >
                  Limpiar filtros
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Side panel: new leads */}
      {panelOpen && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" onClick={() => setPanelOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 h-16 border-b border-slate-200 flex-shrink-0">
              <h2 className="text-base font-semibold">Nuevos leads</h2>
              <button onClick={() => setPanelOpen(false)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Cerrar">
                <Icon name="x" className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 pt-4 flex-shrink-0">
              <div className="flex bg-slate-100 rounded-lg p-1">
                {([["search", "Buscar por zona"], ["direct", "Añadir una web"]] as const).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setPanelTab(k)}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition ${panelTab === k ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-800"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {panelTab === "search" ? (
              <form onSubmit={handleSearch} className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
                  {/* Quick combos */}
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">Búsquedas rápidas</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {QUICK_COMBOS.map(([s, c]) => (
                        <button
                          key={`${s}-${c}`}
                          type="button"
                          onClick={() => selectSearch(s, c)}
                          className="text-xs bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 px-3 py-1.5 rounded-full text-slate-600 transition"
                        >
                          {cap(s)} · {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  {([
                    { key: "sectors" as const, title: "1. Sectores", all: SECTORS, q: sectorQuery, setQ: setSectorQuery, fmt: cap },
                    { key: "cities" as const, title: "2. Ciudades", all: CITIES, q: cityQuery, setQ: setCityQuery, fmt: (x: string) => x },
                  ]).map(({ key, title, all, q, setQ, fmt }) => {
                    const selected = search[key];
                    const visible = all.filter((x) => x.toLowerCase().includes(q.toLowerCase()));
                    return (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-slate-800">
                            {title}
                            {selected.length > 0 && (
                              <span className="ml-2 text-xs font-medium bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{selected.length}</span>
                            )}
                          </p>
                          <div className="flex gap-3 text-xs font-medium">
                            <button type="button" onClick={() => setSearch({ ...search, [key]: [...all] })} className="text-indigo-600 hover:text-indigo-800">Todos</button>
                            <button type="button" onClick={() => setSearch({ ...search, [key]: [] })} className="text-slate-400 hover:text-slate-600">Ninguno</button>
                          </div>
                        </div>
                        <div className="relative mb-2">
                          <Icon name="search" className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Filtrar..."
                            className={`${inputCls} pl-8 py-1.5`}
                          />
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                          {visible.map((x) => {
                            const on = selected.includes(x);
                            return (
                              <button
                                key={x}
                                type="button"
                                onClick={() => toggle(key, x)}
                                className={`inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-full border transition ${
                                  on ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                                }`}
                              >
                                {on && <Icon name="check" className="w-3 h-3" />}
                                {fmt(x)}
                              </button>
                            );
                          })}
                          {visible.length === 0 && <p className="text-sm text-slate-400">Sin resultados</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-slate-200 px-5 py-4 flex-shrink-0 bg-white">
                  {searching ? (
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="flex items-center gap-2 text-slate-700 font-medium">
                          <Spinner className="w-3.5 h-3.5 text-indigo-600" />
                          {searchProgress.label}
                        </span>
                        <span className="text-slate-500">{searchProgress.done + 1}/{searchProgress.total}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-600 rounded-full transition-all duration-500" style={{ width: `${Math.max(progressPct, 4)}%` }} />
                      </div>
                      <p className="text-xs text-slate-500 mt-2">Buscando en local.ch y DuckDuckGo, analizando webs y generando emails. Puedes cerrar este panel.</p>
                    </div>
                  ) : (
                    <button
                      type="submit"
                      disabled={combos === 0}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
                    >
                      <Icon name="search" />
                      {combos === 0
                        ? "Elige al menos un sector y una ciudad"
                        : `Buscar ${combos} ${combos === 1 ? "combinación" : "combinaciones"}`}
                    </button>
                  )}
                </div>
              </form>
            ) : (
              <form onSubmit={handleDirectAdd} className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                  <p className="text-sm text-slate-500">
                    Introduce una web para analizarla (SSL, mobile, velocidad, SEO) y generar un email personalizado.
                  </p>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Nombre del negocio</label>
                    <input
                      type="text"
                      value={directAdd.name}
                      onChange={(e) => setDirectAdd({ ...directAdd, name: e.target.value })}
                      placeholder="Ej: Restaurant Löwen"
                      className={inputCls}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Web</label>
                    <input
                      type="text"
                      value={directAdd.url}
                      onChange={(e) => setDirectAdd({ ...directAdd, url: e.target.value })}
                      placeholder="Ej: www.restaurant-loewen.ch"
                      className={inputCls}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1.5 block">Sector <span className="text-slate-400 font-normal">(opcional)</span></label>
                      <select value={directAdd.sector} onChange={(e) => setDirectAdd({ ...directAdd, sector: e.target.value })} className={inputCls}>
                        <option value="">Seleccionar...</option>
                        {SECTORS.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1.5 block">Ciudad <span className="text-slate-400 font-normal">(opcional)</span></label>
                      <select value={directAdd.city} onChange={(e) => setDirectAdd({ ...directAdd, city: e.target.value })} className={inputCls}>
                        <option value="">Seleccionar...</option>
                        {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="border-t border-slate-200 px-5 py-4 flex-shrink-0">
                  <button
                    type="submit"
                    disabled={addingDirect || (!directAdd.name && !directAdd.url)}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-semibold text-sm disabled:opacity-40 transition shadow-sm"
                  >
                    {addingDirect ? <><Spinner className="w-4 h-4" /> Analizando web...</> : <><Icon name="sparkles" /> Analizar y generar email</>}
                  </button>
                </div>
              </form>
            )}
          </aside>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-md">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${toast.kind === "ok" ? "bg-slate-900" : "bg-rose-600"}`}>
            <Icon name={toast.kind === "ok" ? "check" : "x"} className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{toast.text}</span>
            <button onClick={() => setToast(null)} className="opacity-70 hover:opacity-100" aria-label="Cerrar">
              <Icon name="x" className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
