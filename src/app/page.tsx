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

  async function handleTranslate(lead: Lead, lang: string) {
    setTranslating(lead.id);
    setShowEmail(lead.id);
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
    setSearchStatus(`${totalLeads} leads encontrados (${sectors.length} sectores x ${cities.length} ciudades)`);
    await loadLeads();
    setSearching(false);
    setTimeout(() => setSearchStatus(""), 8000);
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

  // Get unique sectors and cities for filter dropdowns
  const sectors = [...new Set(leads.map((l) => l.sector).filter(Boolean))].sort();
  const cities = [...new Set(leads.map((l) => l.city).filter(Boolean))].sort();

  const [sortBy, setSortBy] = useState<"newest" | "score">("newest");

  const filtered = leads
    .filter((l) => {
      if (filter === "latest") {
        if (!lastSearchIds.has(l.id)) return false;
      } else if (filter !== "all" && l.status !== filter) return false;
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

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Lead Prospector</h1>
            <p className="text-gray-400 mt-1">
              {leads.length} leads guardados | Lweb
            </p>
          </div>
          <a
            href="/api/leads/export"
            className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 text-sm"
          >
            Exportar CSV
          </a>
        </div>

        {/* Search Box */}
        <div className="bg-gray-900 rounded-xl p-6 mb-6 border border-gray-800">
          <h2 className="text-lg font-semibold mb-3">Buscar empresas</h2>
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">Sectores ({search.sectors.length})</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setSearch({ ...search, sectors: [...SECTORS] })} className="text-xs text-blue-400 hover:text-blue-300">Todos</button>
                  <button type="button" onClick={() => setSearch({ ...search, sectors: [] })} className="text-xs text-gray-400 hover:text-gray-300">Ninguno</button>
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 max-h-44 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1">
                {SECTORS.map((s) => (
                  <label key={s} className={`flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded ${search.sectors.includes(s) ? "bg-blue-900/40 text-white" : "text-gray-300 hover:text-white hover:bg-gray-700"}`}>
                    <input
                      type="checkbox"
                      checked={search.sectors.includes(s)}
                      onChange={(e) => {
                        const sectors = e.target.checked
                          ? [...search.sectors, s]
                          : search.sectors.filter((x) => x !== s);
                        setSearch({ ...search, sectors, sector: sectors[0] || "" });
                      }}
                      className="rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-600 focus:ring-offset-0"
                    />
                    <span className="text-sm">{s.charAt(0).toUpperCase() + s.slice(1)}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">Ciudades ({search.cities.length})</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setSearch({ ...search, cities: [...CITIES] })} className="text-xs text-blue-400 hover:text-blue-300">Todas</button>
                  <button type="button" onClick={() => setSearch({ ...search, cities: [] })} className="text-xs text-gray-400 hover:text-gray-300">Ninguna</button>
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 max-h-44 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1">
                {CITIES.map((c) => (
                  <label key={c} className={`flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded ${search.cities.includes(c) ? "bg-blue-900/40 text-white" : "text-gray-300 hover:text-white hover:bg-gray-700"}`}>
                    <input
                      type="checkbox"
                      checked={search.cities.includes(c)}
                      onChange={(e) => {
                        const cities = e.target.checked
                          ? [...search.cities, c]
                          : search.cities.filter((x) => x !== c);
                        setSearch({ ...search, cities, city: cities[0] || "" });
                      }}
                      className="rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-600 focus:ring-offset-0"
                    />
                    <span className="text-sm">{c}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={searching || search.sectors.length === 0 || search.cities.length === 0}
                className="px-6 py-2.5 bg-blue-600 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
              >
                {searching ? "Buscando y analizando..." : `Buscar (${search.sectors.length} x ${search.cities.length} = ${search.sectors.length * search.cities.length} búsquedas)`}
              </button>
              {searchStatus && (
                <span className="text-sm text-yellow-400">{searchStatus}</span>
              )}
            </div>
            {search.sectors.length > 0 && search.cities.length > 0 && (
              <p className="text-xs text-gray-500">
                {search.sectors.length <= 3 ? search.sectors.join(", ") : `${search.sectors.slice(0, 3).join(", ")} +${search.sectors.length - 3}`}
                {" "} en {" "}
                {search.cities.length <= 3 ? search.cities.join(", ") : `${search.cities.slice(0, 3).join(", ")} +${search.cities.length - 3}`}
              </p>
            )}
          </form>

          {/* Quick combos */}
          <div className="mt-4 flex gap-2 flex-wrap">
            <span className="text-xs text-gray-500">Rápido:</span>
            {[
              ["restaurant", "Buchs SG"], ["coiffeur", "Sevelen"], ["zahnarzt", "Grabs"],
              ["autogarage", "Oberriet"], ["anwalt", "Vaduz"], ["elektriker", "Altstätten"],
            ].map(([s, c]) => (
              <button
                key={`${s}-${c}`}
                onClick={() => selectSearch(s, c)}
                className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded-full text-gray-400 hover:text-white"
              >
                {s} {c}
              </button>
            ))}
          </div>

          {searching && (
            <div className="mt-4 bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <div className="text-sm text-gray-300">
                  <p>Buscando en local.ch y DuckDuckGo...</p>
                  <p className="text-gray-500">Analizando webs (SSL, mobile, velocidad, SEO, CTA...)</p>
                  <p className="text-gray-500">Generando emails personalizados con GPT-4...</p>
                  <p className="text-gray-500 mt-1">Esto puede tardar 30-60 segundos</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="space-y-3 mb-6">
          {/* Status filters */}
          <div className="flex gap-2 flex-wrap">
            {(["all", "latest", "new", "contacted", "discarded"] as const).map((f) => {
              const count = f === "all"
                ? leads.length
                : f === "latest"
                ? lastSearchIds.size
                : leads.filter((l) => l.status === f).length;
              const label = f === "all" ? "Todos" : f === "latest" ? "Última búsqueda" : f === "new" ? "Nuevos" : f === "contacted" ? "Contactados" : "Descartados";
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-lg text-sm ${
                    filter === f ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700"
                  } ${f === "latest" && lastSearchIds.size === 0 ? "opacity-40" : ""}`}
                  disabled={f === "latest" && lastSearchIds.size === 0}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>

          {/* Sector, City, Search, Sort */}
          <div className="flex gap-2 flex-wrap items-center">
            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              className="bg-gray-800 px-3 py-1.5 rounded-lg text-sm text-gray-300"
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
              className="bg-gray-800 px-3 py-1.5 rounded-lg text-sm text-gray-300"
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
              className="bg-gray-800 px-3 py-1.5 rounded-lg text-sm text-gray-300"
            >
              <option value="newest">Mas recientes</option>
              <option value="score">Mayor oportunidad</option>
            </select>

            <input
              placeholder="Buscar lead..."
              value={textSearch}
              onChange={(e) => setTextSearch(e.target.value)}
              className="bg-gray-800 px-3 py-1.5 rounded-lg text-sm flex-1 min-w-[150px]"
            />

            {(sectorFilter || cityFilter || textSearch) && (
              <button
                onClick={() => { setSectorFilter(""); setCityFilter(""); setTextSearch(""); }}
                className="text-xs text-gray-400 hover:text-white px-2 py-1"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          {/* Results count */}
          <p className="text-xs text-gray-500">
            Mostrando {filtered.length} de {leads.length} leads
          </p>
        </div>

        {/* Leads List */}
        <div className="space-y-3">
          {filtered.map((lead) => (
            <div
              key={lead.id}
              className={`bg-gray-900 rounded-xl p-5 border ${
                lead.status === "contacted"
                  ? "border-green-800"
                  : lead.status === "discarded"
                  ? "border-gray-700 opacity-60"
                  : "border-gray-800"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg">{lead.name}</h3>
                    {lead.sector && (
                      <span className="text-xs bg-gray-800 px-2 py-0.5 rounded">
                        {lead.sector}
                      </span>
                    )}
                    {lead.city && (
                      <span className="text-xs text-gray-400">{lead.city}</span>
                    )}
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                        lead.score >= 50
                          ? "bg-green-900 text-green-300"
                          : lead.score >= 25
                          ? "bg-yellow-900 text-yellow-300"
                          : "bg-red-900 text-red-300"
                      }`}
                    >
                      Oportunidad: {lead.score}%
                    </span>
                    {lead.status === "contacted" && (
                      <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded">
                        Contactado
                      </span>
                    )}
                  </div>

                  <div className="flex gap-4 text-sm text-gray-400 mb-2">
                    <a
                      href={lead.url.startsWith("http") ? lead.url : "https://" + lead.url}
                      target="_blank"
                      className="hover:text-blue-400 truncate max-w-xs"
                    >
                      {lead.url}
                    </a>
                    {lead.email && (
                      <a href={`mailto:${lead.email}`} className="text-green-400 hover:underline">
                        {lead.email}
                      </a>
                    )}
                    {lead.phone && (
                      <a href={`tel:${lead.phone}`} className="hover:text-white">
                        {lead.phone}
                      </a>
                    )}
                    {!lead.email && (
                      <span className="text-red-400 text-xs">Sin email</span>
                    )}
                  </div>

                  {lead.problems.length > 0 && (
                    <div className="flex gap-2 flex-wrap mb-2">
                      {lead.problems.map((p, i) => (
                        <span
                          key={i}
                          className="text-xs bg-red-950 text-red-400 px-2 py-0.5 rounded"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-1 text-xs text-gray-500">
                    {lead.hasSSL ? (
                      <span className="text-green-500">SSL</span>
                    ) : (
                      <span className="text-red-500">No SSL</span>
                    )}
                    <span>|</span>
                    {lead.hasViewport ? (
                      <span className="text-green-500">Mobile</span>
                    ) : (
                      <span className="text-red-500">No Mobile</span>
                    )}
                    <span>|</span>
                    <span>{lead.loadTime}ms</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 ml-4">
                  <button
                    onClick={() => handleGenerateEmail(lead)}
                    className="px-3 py-1.5 bg-purple-700 rounded-lg text-xs hover:bg-purple-600"
                  >
                    Regenerar Email
                  </button>
                  <button
                    onClick={() => {
                      setShowPromptFor(showPromptFor === lead.id ? null : lead.id);
                      setCustomPrompt("");
                    }}
                    className="px-3 py-1.5 bg-purple-900 rounded-lg text-xs hover:bg-purple-800"
                  >
                    Con instrucciones
                  </button>
                  {lead.status !== "contacted" && (
                    <button
                      onClick={() => updateStatus(lead.id, "contacted")}
                      className="px-3 py-1.5 bg-green-700 rounded-lg text-xs hover:bg-green-600"
                    >
                      Contactado
                    </button>
                  )}
                  {lead.status !== "discarded" && (
                    <button
                      onClick={() => updateStatus(lead.id, "discarded")}
                      className="px-3 py-1.5 bg-gray-700 rounded-lg text-xs hover:bg-gray-600"
                    >
                      Descartar
                    </button>
                  )}
                  <button
                    onClick={() => removeLead(lead.id)}
                    className="px-3 py-1.5 bg-red-900 rounded-lg text-xs hover:bg-red-800"
                  >
                    Eliminar
                  </button>
                </div>
              </div>

              {/* Custom prompt input */}
              {showPromptFor === lead.id && (
                <div className="mt-3 bg-gray-800 rounded-lg p-3 border border-purple-800">
                  <p className="text-xs text-gray-400 mb-2">
                    Instrucciones para GPT (ej: &quot;enfócate en que necesitan reservas online&quot;, &quot;tono más directo&quot;, &quot;menciona que vi su local&quot;)
                  </p>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Escribe tus instrucciones..."
                    className="w-full bg-gray-900 text-white text-sm rounded-lg p-2 mb-2 focus:outline-none focus:ring-1 focus:ring-purple-600 resize-none"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleGenerateEmail(lead, customPrompt)}
                      disabled={!customPrompt.trim() || generatingEmail}
                      className="px-3 py-1.5 bg-purple-700 rounded-lg text-xs hover:bg-purple-600 disabled:opacity-40"
                    >
                      Generar con instrucciones
                    </button>
                    <button
                      onClick={() => { setShowPromptFor(null); setCustomPrompt(""); }}
                      className="px-3 py-1.5 bg-gray-700 rounded-lg text-xs hover:bg-gray-600"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Email Draft - always visible if exists */}
              {lead.emailDraft && (
                <div className="mt-4 bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-300">
                      Email listo para enviar
                    </h4>
                    {lead.email && (() => {
                      const draft = showEmail === lead.id && emailContent ? emailContent : lead.emailDraft;
                      const subjectMatch = draft.match(/^(?:Betreff|Asunto|Subject|Objet|Oggetto):\s*(.+)$/mi);
                      const subject = subjectMatch ? subjectMatch[1].trim() : "Ihre Webseite";
                      const body = subjectMatch ? draft.replace(subjectMatch[0], "").trim() : draft;
                      return (
                        <a
                          href={`mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
                          className="text-xs bg-blue-700 hover:bg-blue-600 px-3 py-1 rounded"
                        >
                          Abrir en Mail
                        </a>
                      );
                    })()}
                  </div>
                  {(generatingEmail && showEmail === lead.id) || (translating === lead.id) ? (
                    <p className="text-gray-400 text-sm">
                      {translating === lead.id ? "Traduciendo..." : "Regenerando con GPT-4..."}
                    </p>
                  ) : (
                    <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans">
                      {showEmail === lead.id && emailContent ? emailContent : lead.emailDraft}
                    </pre>
                  )}
                  <div className="mt-3 flex items-center gap-2 border-t border-gray-700 pt-3">
                    <span className="text-xs text-gray-500">Traducir:</span>
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
                        className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300 disabled:opacity-40"
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center text-gray-500 py-20">
              <p className="text-xl mb-2">No hay leads todavia</p>
              <p>Usa la barra de busqueda arriba para encontrar empresas</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
