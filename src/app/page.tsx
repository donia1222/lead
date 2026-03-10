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

export default function Home() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState("");
  const [showEmail, setShowEmail] = useState<string | null>(null);
  const [emailContent, setEmailContent] = useState("");
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [showPromptFor, setShowPromptFor] = useState<string | null>(null);
  const [translating, setTranslating] = useState<string | null>(null);
  const [lastSearchIds, setLastSearchIds] = useState<Set<string>>(new Set());
  const [showSearch, setShowSearch] = useState(false);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);

  async function handleTranslate(lead: Lead, lang: string) {
    setTranslating(lead.id);
    setShowEmail(lead.id);
    setExpandedEmail(lead.id);
    setEmailContent("");
    const currentEmail = lead.emailDraft;
    const res = await fetch("/api/translate-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lead.id, email: currentEmail, lang }),
    });
    const data = await res.json();
    setEmailContent(data.email || data.error);
    setTranslating(null);
    await loadLeads();
  }

  const [filter, setFilter] = useState<"all" | "new" | "contacted" | "discarded" | "latest">("all");
  const [sectorFilter, setSectorFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [textSearch, setTextSearch] = useState("");
  const [search, setSearch] = useState({ query: "", sector: "", sectors: [] as string[], city: "", cities: [] as string[] });
  const [directAdd, setDirectAdd] = useState({ name: "", url: "", sector: "", city: "" });
  const [addingDirect, setAddingDirect] = useState(false);
  const [directStatus, setDirectStatus] = useState("");

  const loadLeads = useCallback(async () => {
    const res = await fetch("/api/leads");
    const data = await res.json();
    setLeads(data);
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

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
      setSearchStatus(`Buscando ${sector} en ${city} (${i + 1}/${combos.length})...`);

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
    setSearchStatus(`${totalLeads} leads encontrados`);
    await loadLeads();
    setSearching(false);
    setTimeout(() => setSearchStatus(""), 8000);
  }

  async function handleDirectAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!directAdd.name && !directAdd.url) return;

    setAddingDirect(true);
    setDirectStatus("Analizando web y generando email...");

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
        setDirectStatus("Error: " + data.error);
      } else {
        setLastSearchIds(new Set([data.id]));
        setFilter("latest");
        setDirectStatus("Lead añadido correctamente");
        setDirectAdd({ name: "", url: "", sector: "", city: "" });
        await loadLeads();
      }
    } catch {
      setDirectStatus("Error al analizar la web");
    }

    setAddingDirect(false);
    setTimeout(() => setDirectStatus(""), 5000);
  }

  function selectSearch(sector: string, city: string) {
    setSearch({ query: `${sector} ${city}`, sector, sectors: [sector], city, cities: [city] });
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

  const sectors = [...new Set(leads.map((l) => l.sector).filter(Boolean))].sort();
  const cities = [...new Set(leads.map((l) => l.city).filter(Boolean))].sort();

  const [sortBy, setSortBy] = useState<"newest" | "score">("newest");

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

  const countAll = leads.filter((l) => l.status !== "discarded").length;
  const countNew = leads.filter((l) => l.status === "new").length;
  const countContacted = leads.filter((l) => l.status === "contacted").length;
  const countDiscarded = leads.filter((l) => l.status === "discarded").length;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Lead Prospector
            </h1>
            <span className="text-sm text-slate-400 hidden sm:block">
              {leads.length} leads guardados
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition ${
                showSearch
                  ? "bg-slate-200 text-slate-700"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {showSearch ? "Cerrar buscador" : "Nueva busqueda"}
            </button>
            <a
              href="/api/leads/export"
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
            >
              Exportar CSV
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Search Panel - collapsible */}
        {showSearch && (
          <div className="bg-white rounded-2xl p-8 mb-8 border border-slate-200 shadow-sm">
            <h2 className="text-xl font-semibold mb-5 text-slate-800">Buscar empresas</h2>
            <form onSubmit={handleSearch} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sectors */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-600">
                      Sectores ({search.sectors.length})
                    </label>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => setSearch({ ...search, sectors: [...SECTORS] })} className="text-xs font-medium text-blue-600 hover:text-blue-800">Todos</button>
                      <button type="button" onClick={() => setSearch({ ...search, sectors: [] })} className="text-xs font-medium text-slate-400 hover:text-slate-600">Ninguno</button>
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-48 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-1">
                    {SECTORS.map((s) => (
                      <label key={s} className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg text-sm transition ${search.sectors.includes(s) ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-600 hover:bg-slate-100"}`}>
                        <input
                          type="checkbox"
                          checked={search.sectors.includes(s)}
                          onChange={(e) => {
                            const sectors = e.target.checked
                              ? [...search.sectors, s]
                              : search.sectors.filter((x) => x !== s);
                            setSearch({ ...search, sectors, sector: sectors[0] || "" });
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Cities */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-600">
                      Ciudades ({search.cities.length})
                    </label>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => setSearch({ ...search, cities: [...CITIES] })} className="text-xs font-medium text-blue-600 hover:text-blue-800">Todas</button>
                      <button type="button" onClick={() => setSearch({ ...search, cities: [] })} className="text-xs font-medium text-slate-400 hover:text-slate-600">Ninguna</button>
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-48 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-1">
                    {CITIES.map((c) => (
                      <label key={c} className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg text-sm transition ${search.cities.includes(c) ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-600 hover:bg-slate-100"}`}>
                        <input
                          type="checkbox"
                          checked={search.cities.includes(c)}
                          onChange={(e) => {
                            const cities = e.target.checked
                              ? [...search.cities, c]
                              : search.cities.filter((x) => x !== c);
                            setSearch({ ...search, cities, city: cities[0] || "" });
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        {c}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick combos */}
              <div className="flex gap-2 flex-wrap items-center">
                <span className="text-sm text-slate-400">Rapido:</span>
                {[
                  ["restaurant", "Buchs SG"], ["coiffeur", "Sevelen"], ["zahnarzt", "Grabs"],
                  ["autogarage", "Oberriet"], ["anwalt", "Vaduz"], ["elektriker", "Altstätten"],
                ].map(([s, c]) => (
                  <button
                    key={`${s}-${c}`}
                    type="button"
                    onClick={() => selectSearch(s, c)}
                    className="text-sm bg-slate-100 hover:bg-slate-200 px-4 py-1.5 rounded-full text-slate-600 hover:text-slate-800 transition"
                  >
                    {s} {c}
                  </button>
                ))}
              </div>

              {/* Search button */}
              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  disabled={searching || search.sectors.length === 0 || search.cities.length === 0}
                  className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold text-base disabled:opacity-40 transition shadow-sm"
                >
                  {searching ? "Buscando..." : `Buscar (${search.sectors.length * search.cities.length} combinaciones)`}
                </button>
                {searchStatus && (
                  <span className="text-sm font-medium text-amber-600">{searchStatus}</span>
                )}
              </div>
            </form>

            {searching && (
              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-5">
                <div className="flex items-center gap-4">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <div className="text-sm text-slate-700">
                    <p className="font-medium">Buscando en local.ch y DuckDuckGo...</p>
                    <p className="text-slate-500 mt-1">Analizando webs y generando emails con GPT-4 (30-60s)</p>
                  </div>
                </div>
              </div>
            )}

            {/* Direct add section */}
            <div className="mt-8 pt-8 border-t border-slate-200">
              <h3 className="text-lg font-semibold mb-4 text-slate-800">Añadir negocio directo</h3>
              <p className="text-sm text-slate-500 mb-4">Introduce una URL o nombre de negocio para analizar su web y generar el email</p>
              <form onSubmit={handleDirectAdd} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-600 mb-1 block">Nombre del negocio *</label>
                    <input
                      type="text"
                      value={directAdd.name}
                      onChange={(e) => setDirectAdd({ ...directAdd, name: e.target.value })}
                      placeholder="Ej: Restaurant Löwen"
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600 mb-1 block">URL de la web *</label>
                    <input
                      type="text"
                      value={directAdd.url}
                      onChange={(e) => setDirectAdd({ ...directAdd, url: e.target.value })}
                      placeholder="Ej: www.restaurant-loewen.ch"
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600 mb-1 block">Sector</label>
                    <select
                      value={directAdd.sector}
                      onChange={(e) => setDirectAdd({ ...directAdd, sector: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Seleccionar sector...</option>
                      {SECTORS.map((s) => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600 mb-1 block">Ciudad</label>
                    <select
                      value={directAdd.city}
                      onChange={(e) => setDirectAdd({ ...directAdd, city: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Seleccionar ciudad...</option>
                      {CITIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    type="submit"
                    disabled={addingDirect || (!directAdd.name && !directAdd.url)}
                    className="px-8 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-semibold text-sm disabled:opacity-40 transition shadow-sm"
                  >
                    {addingDirect ? "Analizando..." : "Analizar y generar email"}
                  </button>
                  {directStatus && (
                    <span className={`text-sm font-medium ${directStatus.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>
                      {directStatus}
                    </span>
                  )}
                </div>
              </form>

              {addingDirect && (
                <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                  <div className="flex items-center gap-4">
                    <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <div className="text-sm text-slate-700">
                      <p className="font-medium">Analizando la web...</p>
                      <p className="text-slate-500 mt-1">Comprobando SSL, mobile, velocidad, SEO y generando email personalizado</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: "Activos", count: countAll, color: "bg-blue-50 border-blue-200 text-blue-700", f: "all" as const },
            { label: "Nuevos", count: countNew, color: "bg-slate-50 border-slate-200 text-slate-700", f: "new" as const },
            { label: "Contactados", count: countContacted, color: "bg-emerald-50 border-emerald-200 text-emerald-700", f: "contacted" as const },
            { label: "Descartados", count: countDiscarded, color: "bg-orange-50 border-orange-200 text-orange-600", f: "discarded" as const },
          ].map((stat) => (
            <button
              key={stat.f}
              onClick={() => setFilter(stat.f)}
              className={`rounded-xl border p-4 text-left transition hover:shadow-sm ${stat.color} ${
                filter === stat.f ? "ring-2 ring-blue-500 shadow-sm" : ""
              }`}
            >
              <p className="text-3xl font-bold">{stat.count}</p>
              <p className="text-sm font-medium mt-1">{stat.label}</p>
            </button>
          ))}
        </div>

        {/* Filters row */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap items-center gap-3">
          {lastSearchIds.size > 0 && (
            <button
              onClick={() => setFilter("latest")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === "latest"
                  ? "bg-amber-100 text-amber-800 ring-2 ring-amber-400"
                  : "bg-amber-50 text-amber-700 hover:bg-amber-100"
              }`}
            >
              Ultima busqueda ({lastSearchIds.size})
            </button>
          )}

          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg text-sm text-slate-700"
          >
            <option value="">Todos los sectores</option>
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s} ({leads.filter((l) => l.sector === s).length})
              </option>
            ))}
          </select>

          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg text-sm text-slate-700"
          >
            <option value="">Todas las ciudades</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c} ({leads.filter((l) => l.city === c).length})
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "newest" | "score")}
            className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg text-sm text-slate-700"
          >
            <option value="newest">Mas recientes</option>
            <option value="score">Mayor oportunidad</option>
          </select>

          <input
            placeholder="Buscar lead..."
            value={textSearch}
            onChange={(e) => setTextSearch(e.target.value)}
            className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg text-sm flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          {(sectorFilter || cityFilter || textSearch) && (
            <button
              onClick={() => { setSectorFilter(""); setCityFilter(""); setTextSearch(""); }}
              className="text-sm text-slate-400 hover:text-slate-600 px-3 py-2 transition"
            >
              Limpiar
            </button>
          )}

          <span className="text-sm text-slate-400 ml-auto">
            {filtered.length} leads
          </span>
        </div>

        {/* Leads table */}
        <div className="space-y-4">
          {filtered.map((lead) => (
            <div
              key={lead.id}
              className={`bg-white rounded-2xl border p-6 transition hover:shadow-md ${
                lead.status === "contacted"
                  ? "border-emerald-300"
                  : lead.status === "discarded"
                  ? "border-orange-200 opacity-70"
                  : "border-slate-200"
              }`}
            >
              <div className="flex items-start gap-6">
                {/* Score circle */}
                <div className={`w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xl ${
                  lead.score >= 50
                    ? "bg-emerald-100 text-emerald-700"
                    : lead.score >= 25
                    ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-600"
                }`}>
                  {lead.score}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-xl font-semibold text-slate-900 truncate">{lead.name}</h3>
                    {lead.status === "contacted" && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-medium">
                        Contactado
                      </span>
                    )}
                    {lead.status === "discarded" && (
                      <span className="text-xs bg-orange-100 text-orange-600 px-2.5 py-1 rounded-full font-medium">
                        Descartado
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    {lead.sector && (
                      <span className="text-sm bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                        {lead.sector.charAt(0).toUpperCase() + lead.sector.slice(1)}
                      </span>
                    )}
                    {lead.city && (
                      <span className="text-sm text-slate-500">{lead.city}</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm mb-3">
                    <a
                      href={lead.url.startsWith("http") ? lead.url : "https://" + lead.url}
                      target="_blank"
                      className="text-blue-600 hover:text-blue-800 hover:underline truncate max-w-sm"
                    >
                      {lead.url}
                    </a>
                    {lead.email ? (
                      <a href={`mailto:${lead.email}`} className="text-emerald-600 hover:underline font-medium">
                        {lead.email}
                      </a>
                    ) : (
                      <span className="text-red-400 text-sm">Sin email</span>
                    )}
                    {lead.phone && (
                      <a href={`tel:${lead.phone}`} className="text-slate-500 hover:text-slate-700">
                        {lead.phone}
                      </a>
                    )}
                  </div>

                  {/* Problems */}
                  {lead.problems.length > 0 && (
                    <div className="flex gap-2 flex-wrap mb-3">
                      {lead.problems.map((p, i) => (
                        <span
                          key={i}
                          className="text-xs bg-red-50 text-red-600 px-2.5 py-1 rounded-full border border-red-200"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Tech badges */}
                  <div className="flex gap-2 text-xs">
                    <span className={`px-2.5 py-1 rounded-full ${lead.hasSSL ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
                      {lead.hasSSL ? "SSL" : "No SSL"}
                    </span>
                    <span className={`px-2.5 py-1 rounded-full ${lead.hasViewport ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
                      {lead.hasViewport ? "Mobile OK" : "No Mobile"}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
                      {lead.loadTime}ms
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {lead.email && (() => {
                    const draft = showEmail === lead.id && emailContent ? emailContent : lead.emailDraft;
                    if (!draft) return null;
                    const subjectMatch = draft.match(/^(?:Betreff|Asunto|Subject|Objet|Oggetto):\s*(.+)$/mi);
                    const subject = subjectMatch ? subjectMatch[1].trim() : "Ihre Webseite";
                    const body = subjectMatch ? draft.replace(subjectMatch[0], "").trim() : draft;
                    return (
                      <a
                        href={`mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
                        className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition text-center shadow-sm"
                      >
                        Enviar Email
                      </a>
                    );
                  })()}
                  <button
                    onClick={() => handleGenerateEmail(lead)}
                    className="px-4 py-2 bg-violet-100 text-violet-700 rounded-xl text-sm font-medium hover:bg-violet-200 transition"
                  >
                    Regenerar
                  </button>
                  <button
                    onClick={() => {
                      setShowPromptFor(showPromptFor === lead.id ? null : lead.id);
                      setCustomPrompt("");
                    }}
                    className="px-4 py-2 bg-violet-50 text-violet-600 rounded-xl text-sm hover:bg-violet-100 transition"
                  >
                    Personalizar
                  </button>
                  {lead.status !== "contacted" && (
                    <button
                      onClick={() => updateStatus(lead.id, "contacted")}
                      className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl text-sm font-medium hover:bg-emerald-200 transition"
                    >
                      Contactado
                    </button>
                  )}
                  {lead.status !== "discarded" && (
                    <button
                      onClick={() => updateStatus(lead.id, "discarded")}
                      className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl text-sm hover:bg-slate-200 transition"
                    >
                      Descartar
                    </button>
                  )}
                  <button
                    onClick={() => removeLead(lead.id)}
                    className="px-4 py-2 text-red-400 rounded-xl text-sm hover:bg-red-50 hover:text-red-600 transition"
                  >
                    Eliminar
                  </button>
                </div>
              </div>

              {/* Custom prompt input */}
              {showPromptFor === lead.id && (
                <div className="mt-5 bg-violet-50 rounded-xl p-5 border border-violet-200">
                  <p className="text-sm text-slate-600 mb-3">
                    Instrucciones para GPT (ej: &quot;enfocate en que necesitan reservas online&quot;, &quot;tono mas directo&quot;)
                  </p>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Escribe tus instrucciones..."
                    className="w-full bg-white text-slate-800 text-sm rounded-xl p-4 mb-3 focus:outline-none focus:ring-2 focus:ring-violet-500 border border-violet-200 resize-none"
                    rows={2}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleGenerateEmail(lead, customPrompt)}
                      disabled={!customPrompt.trim() || generatingEmail}
                      className="px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 disabled:opacity-40 transition"
                    >
                      Generar
                    </button>
                    <button
                      onClick={() => { setShowPromptFor(null); setCustomPrompt(""); }}
                      className="px-5 py-2.5 bg-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-300 transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Email Draft - collapsed by default */}
              {lead.emailDraft && (
                <div className="mt-4">
                  <button
                    onClick={() => setExpandedEmail(expandedEmail === lead.id ? null : lead.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition border ${
                      expandedEmail === lead.id
                        ? "bg-violet-100 text-violet-700 border-violet-300"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    {expandedEmail === lead.id ? "Ocultar email" : "Ver email borrador"}
                    <svg className={`w-4 h-4 transition-transform ${expandedEmail === lead.id ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expandedEmail === lead.id && (
                    <div className="mt-3 bg-slate-50 rounded-xl p-5 border border-slate-200">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-slate-700">
                          Email borrador
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">Traducir:</span>
                          {[
                            { code: "de", label: "DE" },
                            { code: "es", label: "ES" },
                            { code: "en", label: "EN" },
                            { code: "fr", label: "FR" },
                            { code: "it", label: "IT" },
                          ].map((lang) => (
                            <button
                              key={lang.code}
                              onClick={() => handleTranslate(lead, lang.code)}
                              disabled={translating === lead.id}
                              className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-xs text-slate-600 disabled:opacity-40 transition"
                            >
                              {lang.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {(generatingEmail && showEmail === lead.id) || (translating === lead.id) ? (
                        <div className="flex items-center gap-3 py-4">
                          <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                          <p className="text-slate-500 text-sm">
                            {translating === lead.id ? "Traduciendo..." : "Regenerando con GPT-4..."}
                          </p>
                        </div>
                      ) : (
                        <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                          {showEmail === lead.id && emailContent ? emailContent : lead.emailDraft}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-24">
              <p className="text-2xl font-semibold text-slate-400 mb-2">No hay leads</p>
              <p className="text-slate-400">Usa el boton &quot;Nueva busqueda&quot; para encontrar empresas</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
