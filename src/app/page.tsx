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

const SEARCH_EXAMPLES = [
  "restaurant Buchs SG",
  "coiffeur Sevelen",
  "zahnarzt Werdenberg",
  "immobilien Liechtenstein",
  "hotel Sargans",
  "autogarage Grabs",
  "anwalt St. Gallen",
  "bäckerei Vaduz",
];

export default function Home() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState("");
  const [showEmail, setShowEmail] = useState<string | null>(null);
  const [emailContent, setEmailContent] = useState("");
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [filter, setFilter] = useState<"all" | "new" | "contacted" | "discarded">("all");
  const [search, setSearch] = useState({ query: "", sector: "", city: "" });

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
    if (!search.query.trim()) return;

    setSearching(true);
    setSearchStatus("Buscando empresas...");

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(search),
      });
      const data = await res.json();
      setSearchStatus(data.message || "Busqueda completada");
      await loadLeads();
    } catch {
      setSearchStatus("Error en la busqueda");
    }

    setSearching(false);
    setTimeout(() => setSearchStatus(""), 5000);
  }

  function useExample(example: string) {
    const parts = example.split(" ");
    const city = parts.slice(1).join(" ");
    setSearch({ query: example, sector: parts[0], city });
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

  async function handleGenerateEmail(lead: Lead) {
    setShowEmail(lead.id);
    setGeneratingEmail(true);
    setEmailContent("");
    const res = await fetch("/api/generate-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: lead.id,
        name: lead.name,
        city: lead.city,
        sector: lead.sector,
        problems: lead.problems,
      }),
    });
    const data = await res.json();
    setEmailContent(data.email || data.error);
    setGeneratingEmail(false);
    await loadLeads();
  }

  const filtered = leads.filter((l) => filter === "all" || l.status === filter);

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
            <div className="flex gap-3">
              <input
                placeholder="Ej: restaurant Buchs SG, zahnarzt Werdenberg..."
                value={search.query}
                onChange={(e) => setSearch({ ...search, query: e.target.value })}
                className="flex-1 bg-gray-800 px-4 py-3 rounded-lg text-lg"
                required
              />
              <input
                placeholder="Sector"
                value={search.sector}
                onChange={(e) => setSearch({ ...search, sector: e.target.value })}
                className="w-40 bg-gray-800 px-4 py-3 rounded-lg"
              />
              <input
                placeholder="Ciudad"
                value={search.city}
                onChange={(e) => setSearch({ ...search, city: e.target.value })}
                className="w-40 bg-gray-800 px-4 py-3 rounded-lg"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={searching}
                className="px-6 py-2.5 bg-blue-600 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
              >
                {searching ? "Buscando y analizando..." : "Buscar, analizar y generar emails"}
              </button>
              {searchStatus && (
                <span className="text-sm text-yellow-400">{searchStatus}</span>
              )}
            </div>
          </form>

          {/* Quick search examples */}
          <div className="mt-4 flex gap-2 flex-wrap">
            <span className="text-xs text-gray-500">Ejemplos:</span>
            {SEARCH_EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => useExample(ex)}
                className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded-full text-gray-400 hover:text-white"
              >
                {ex}
              </button>
            ))}
          </div>

          {searching && (
            <div className="mt-4 bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <div className="text-sm text-gray-300">
                  <p>Buscando empresas en Google y local.ch...</p>
                  <p className="text-gray-500">Analizando webs (SSL, mobile, velocidad, SEO, CTA...)</p>
                  <p className="text-gray-500">Generando emails personalizados con GPT-4...</p>
                  <p className="text-gray-500 mt-1">Esto puede tardar 30-60 segundos</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {(["all", "new", "contacted", "discarded"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-lg text-sm ${
                filter === f ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700"
              }`}
            >
              {f === "all" ? "Todos" : f === "new" ? "Nuevos" : f === "contacted" ? "Contactados" : "Descartados"}
              {f === "all"
                ? ` (${leads.length})`
                : ` (${leads.filter((l) => l.status === f).length})`}
            </button>
          ))}
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
                          ? "bg-red-900 text-red-300"
                          : lead.score >= 25
                          ? "bg-yellow-900 text-yellow-300"
                          : "bg-green-900 text-green-300"
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

              {/* Email Draft - always visible if exists */}
              {lead.emailDraft && (
                <div className="mt-4 bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-300">
                      Email listo para enviar
                    </h4>
                    {lead.email && (
                      <a
                        href={`mailto:${lead.email}?subject=Ihre Webseite&body=${encodeURIComponent(lead.emailDraft)}`}
                        className="text-xs bg-blue-700 hover:bg-blue-600 px-3 py-1 rounded"
                      >
                        Abrir en Mail
                      </a>
                    )}
                  </div>
                  {generatingEmail && showEmail === lead.id ? (
                    <p className="text-gray-400 text-sm">Regenerando con GPT-4...</p>
                  ) : (
                    <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans">
                      {showEmail === lead.id && emailContent ? emailContent : lead.emailDraft}
                    </pre>
                  )}
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
