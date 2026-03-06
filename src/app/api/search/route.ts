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

  if (!query) {
    return NextResponse.json({ error: "Falta query" }, { status: 400 });
  }

  // Check existing leads to avoid duplicates
  const existingLeads = getLeads();
  const existingDomains = new Set(existingLeads.map((l) => getDomain(l.url)));
  const skipped: string[] = [];

  // Step 1: Search for businesses
  const searchResults = await searchBusinesses(query);

  if (searchResults.length === 0) {
    return NextResponse.json({ leads: [], message: "No se encontraron resultados" });
  }

  // Step 2: Filter out already existing leads
  const newResults = searchResults.filter((r) => {
    const domain = getDomain(r.url);
    if (existingDomains.has(domain)) {
      skipped.push(r.name);
      return false;
    }
    return true;
  });

  if (newResults.length === 0) {
    return NextResponse.json({
      leads: [],
      message: `Ya tienes todos los resultados guardados (${skipped.length} duplicados saltados)`,
    });
  }

  // Step 3: Analyze each website + generate email (max 6)
  const leads: Lead[] = [];

  for (const result of newResults.slice(0, 6)) {
    try {
      // Use email/phone from directory if available
      const data = await scrapeWebsite(result.url);
      const score = calculateScore(data);

      const email = data.emails[0] || result.email || "";
      const phone = data.phones[0] || result.phone || "";

      // Generate personalized email based on real problems found
      let emailDraft = "";
      try {
        emailDraft = await generateEmail(
          result.name,
          city || "der Region",
          sector || "Unternehmen",
          data.problems
        );
      } catch {
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
        contactPage: data.contactPage,
        hasSSL: data.hasSSL,
        hasViewport: data.hasViewport,
        loadTime: data.loadTime,
        score,
        problems: data.problems,
        status: "new",
        emailDraft,
        createdAt: new Date().toISOString(),
      };

      saveLead(lead);
      leads.push(lead);

      // Delay between requests
      await new Promise((r) => setTimeout(r, 1000));
    } catch {
      // Skip failed websites
    }
  }

  const skipMsg = skipped.length > 0 ? ` | ${skipped.length} ya existian` : "";

  return NextResponse.json({
    leads,
    message: `${leads.length} nuevos leads analizados con email${skipMsg}`,
  });
}
