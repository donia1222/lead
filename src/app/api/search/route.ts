import { NextRequest, NextResponse } from "next/server";
import { searchBusinesses } from "@/lib/search";
import { scrapeWebsite, calculateScore } from "@/lib/scraper";
import { generateEmail } from "@/lib/ai";
import { saveLead, getLeads } from "@/lib/leads-store";
import { Lead } from "@/lib/types";

function getDomain(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : "https://" + url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

export async function POST(req: NextRequest) {
  const { query, sector, city } = await req.json();
  console.log(`\n====== API /search called: query="${query}" sector="${sector}" city="${city}" ======`);

  if (!query) {
    return NextResponse.json({ error: "Falta query" }, { status: 400 });
  }

  // Check existing leads to avoid duplicates
  const existingLeads = getLeads();
  const existingDomains = new Set(existingLeads.map((l) => getDomain(l.url)));
  console.log(`[API] Leads existentes: ${existingLeads.length} | Dominios: ${existingDomains.size}`);
  const skipped: string[] = [];

  // Step 1: Search for businesses
  const searchResults = await searchBusinesses(query);
  console.log(`[API] Search devolvio ${searchResults.length} resultados totales`);

  if (searchResults.length === 0) {
    console.log("[API] NO HAY RESULTADOS - devolviendo vacio");
    return NextResponse.json({ leads: [], message: "No se encontraron resultados" });
  }

  // Step 2: Filter out already existing leads
  const existingNames = new Set(existingLeads.map((l) => l.name.toLowerCase()));
  const newResults = searchResults.filter((r) => {
    const domain = r.url ? getDomain(r.url) : "";
    if (domain && existingDomains.has(domain)) {
      console.log(`[API] DUPLICADO saltado: ${r.name} (${domain})`);
      skipped.push(r.name);
      return false;
    }
    if (!domain && existingNames.has(r.name.toLowerCase())) {
      console.log(`[API] DUPLICADO saltado (por nombre): ${r.name}`);
      skipped.push(r.name);
      return false;
    }
    return true;
  });

  console.log(`[API] Nuevos (sin duplicados): ${newResults.length} | Saltados: ${skipped.length}`);

  if (newResults.length === 0) {
    console.log("[API] Todos son duplicados");
    return NextResponse.json({
      leads: [],
      message: `Ya tienes todos los resultados guardados (${skipped.length} duplicados saltados)`,
    });
  }

  // Step 3: Analyze each website + generate email (max 6)
  const leads: Lead[] = [];

  for (let i = 0; i < Math.min(newResults.length, 6); i++) {
    const result = newResults[i];
    console.log(`\n[API] --- Procesando ${i + 1}/${Math.min(newResults.length, 6)}: ${result.name} (${result.url}) ---`);

    try {
      let email = result.email || "";
      let phone = result.phone || "";
      let score = 0;
      let problems: string[] = [];
      let contactPage = "";
      let hasSSL = false;
      let hasViewport = false;
      let loadTime = 0;

      if (result.url) {
        // Has website — scrape and analyze
        console.log(`[API] Scraping ${result.url}...`);
        const data = await scrapeWebsite(result.url);
        score = calculateScore(data);
        problems = data.problems;
        contactPage = data.contactPage;
        hasSSL = data.hasSSL;
        hasViewport = data.hasViewport;
        loadTime = data.loadTime;
        email = data.emails[0] || email;
        phone = data.phones[0] || phone;
        console.log(`[API] Scrape OK: score=${score} emails=${data.emails.length} phones=${data.phones.length} problems=${problems.length} loadTime=${loadTime}ms`);
        console.log(`[API] Problems: ${problems.join(" | ")}`);
      } else {
        // No website — highest opportunity!
        console.log(`[API] Sin website - lead de alta oportunidad`);
        score = 70;
        problems = ["Keine eigene Webseite vorhanden"];
      }

      // Generate personalized email
      console.log(`[API] Generando email con GPT-4...`);
      let emailDraft = "";
      try {
        emailDraft = await generateEmail(
          result.name,
          city || "der Region",
          sector || "Unternehmen",
          problems
        );
        console.log(`[API] Email generado OK (${emailDraft.length} chars)`);
      } catch (e) {
        console.log(`[API] ERROR generando email: ${e instanceof Error ? e.message : e}`);
        emailDraft = "(Error generando email - revisa tu API key de OpenAI)";
      }

      const lead: Lead = {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
        name: result.name,
        sector: sector || "",
        city: city || "",
        url: result.url,
        email,
        phone,
        contactPage,
        hasSSL,
        hasViewport,
        loadTime,
        score,
        problems,
        status: "new",
        emailDraft,
        createdAt: new Date().toISOString(),
      };

      saveLead(lead);
      leads.push(lead);
      console.log(`[API] Lead guardado: ${result.name} (${email || "sin email"})`);

      // Delay between requests
      await new Promise((r) => setTimeout(r, 1000));
    } catch (e) {
      console.log(`[API] ERROR procesando ${result.name}: ${e instanceof Error ? e.message : e}`);
    }
  }

  const skipMsg = skipped.length > 0 ? ` | ${skipped.length} ya existian` : "";
  console.log(`\n====== API /search DONE: ${leads.length} leads creados${skipMsg} ======\n`);

  return NextResponse.json({
    leads,
    message: `${leads.length} nuevos leads analizados con email${skipMsg}`,
  });
}
