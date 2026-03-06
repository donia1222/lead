import axios from "axios";
import * as cheerio from "cheerio";

export interface SearchResult {
  name: string;
  url: string;
  email: string;
  phone: string;
}

const HTTP = {
  timeout: 15000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
};

const IGNORE_DOMAINS = [
  "local.ch", "localsearch.ch", "search.ch", "google",
  "facebook.com", "instagram.com", "linkedin.com", "twitter.com", "x.com",
  "tripadvisor", "yelp.com", "youtube.com", "wikipedia.org",
  "renovero.ch", "localcities.ch", "swissmadesoftware",
  "profile.localsearch", "cc.localsearch",
];

function isBusinessUrl(href: string): boolean {
  if (!href.startsWith("http")) return false;
  return !IGNORE_DOMAINS.some((d) => href.includes(d));
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

export async function searchBusinesses(query: string): Promise<SearchResult[]> {
  console.log(`\n========== SEARCH START: "${query}" ==========`);
  const results: SearchResult[] = [];

  // 1. Search on local.ch with multiple query variations
  const parts = query.trim().split(/\s+/);
  const what = parts[0];
  const where = parts.slice(1).join(" ") || "";

  // Try the exact query first, then broader if needed
  const queries = [
    { where, what },
  ];

  // If "Werdenberg" or similar region, also try nearby cities
  const regionExpansion: Record<string, string[]> = {
    "werdenberg": ["Buchs SG", "Grabs", "Sevelen"],
    "rheintal": ["Buchs SG", "Altstätten", "Heerbrugg"],
    "liechtenstein": ["Vaduz", "Schaan", "Balzers"],
    "sarganserland": ["Sargans", "Bad Ragaz", "Mels"],
  };

  const whereLower = where.toLowerCase();
  for (const [region, cities] of Object.entries(regionExpansion)) {
    if (whereLower.includes(region)) {
      cities.forEach((city) => queries.push({ where: city, what }));
    }
  }

  for (const q of queries) {
    if (results.length >= 6) break;
    try {
      console.log(`[1] Buscando en local.ch: "${q.what}" en "${q.where}"...`);
      const localResults = await searchLocalCh(q.what, q.where);
      console.log(`[1] local.ch devolvio ${localResults.length} resultados`);
      localResults.forEach((r, i) => console.log(`  [1.${i}] ${r.name} | ${r.url}`));
      results.push(...localResults);
    } catch (e) {
      console.log(`[1] local.ch FALLO: ${e instanceof Error ? e.message : e}`);
    }
  }

  // 2. Fallback: DuckDuckGo
  if (results.length < 6) {
    try {
      console.log(`[2] DuckDuckGo fallback (tenemos ${results.length})...`);
      const ddgResults = await searchDuckDuckGo(query);
      console.log(`[2] DuckDuckGo devolvio ${ddgResults.length} resultados`);
      ddgResults.forEach((r, i) => console.log(`  [2.${i}] ${r.name} | ${r.url}`));
      results.push(...ddgResults);
    } catch (e) {
      console.log(`[2] DuckDuckGo FALLO: ${e instanceof Error ? e.message : e}`);
    }
  }

  // Deduplicate by domain (or by name if no URL)
  const seen = new Set<string>();
  const deduped = results.filter((r) => {
    const key = r.url ? getDomain(r.url) : r.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`========== SEARCH END: ${deduped.length} resultados unicos ==========\n`);
  return deduped;
}

async function searchLocalCh(what: string, where: string): Promise<SearchResult[]> {
  const url = `https://www.local.ch/de/q/${encodeURIComponent(where)}/${encodeURIComponent(what)}`;
  console.log(`  [local.ch] URL: ${url}`);

  const res = await axios.get(url, HTTP);
  const $ = cheerio.load(res.data);
  const html = res.data as string;
  console.log(`  [local.ch] HTML length: ${html.length}`);

  // Method 1: Extract detail links from href attributes
  const detailPaths = new Set<string>();

  // Find all /de/d/ links in HTML (both in <a> tags and in scripts)
  const hrefMatches = html.match(/\/de\/d\/[^"'\s\\]+/g) || [];
  for (const path of hrefMatches) {
    const clean = path.replace(/\\$/, "").replace(/\\"/g, "");
    if (clean.length > 15 && !detailPaths.has(clean)) {
      detailPaths.add(clean);
    }
  }

  console.log(`  [local.ch] Detail paths encontrados: ${detailPaths.size}`);

  // Method 2: Also try to extract data from JSON in script tags
  const jsonResults: SearchResult[] = [];
  $("script").each((_, el) => {
    const text = $(el).html() || "";
    if (text.includes(what) || text.includes(what.charAt(0).toUpperCase() + what.slice(1))) {
      // Try to find business URLs and names in JSON
      const urlMatches = text.match(/https?:\/\/[^\s"'\\]+\.(ch|li|com|de|at)[^\s"'\\]*/g) || [];
      for (const u of urlMatches) {
        const clean = u.replace(/\\$/, "").replace(/\\"/g, "");
        if (isBusinessUrl(clean)) {
          // Try to find associated name nearby in the JSON
          try {
            const domain = getDomain(clean);
            const escapedDomain = domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const nameMatch = text.match(new RegExp(`"name"\\s*:\\s*"([^"]+)"[^}]*${escapedDomain}`));
            if (nameMatch) {
              jsonResults.push({ name: nameMatch[1], url: clean, email: "", phone: "" });
            }
          } catch {
            // Skip if regex fails
          }
        }
      }
    }
  });

  if (jsonResults.length > 0) {
    console.log(`  [local.ch] Found ${jsonResults.length} results from JSON data`);
  }

  // Visit detail pages
  const results: SearchResult[] = [];
  const pathArray = [...detailPaths];

  for (const path of pathArray.slice(0, 12)) {
    if (results.length >= 6) break;

    try {
      await new Promise((r) => setTimeout(r, 600));
      const detailUrl = "https://www.local.ch" + path;
      console.log(`  [local.ch] Visitando: ${path.split("/").pop()?.substring(0, 40)}...`);
      const detailRes = await axios.get(detailUrl, HTTP);
      const d = cheerio.load(detailRes.data);

      const name = d("h1").text().trim().split("\n")[0].trim();
      let email = "";
      let phone = "";
      const businessUrls: string[] = [];

      d("a").each((_, a) => {
        const href = d(a).attr("href") || "";
        if (isBusinessUrl(href)) {
          businessUrls.push(href);
        }
        if (!email && href.startsWith("mailto:")) {
          email = href.replace("mailto:", "");
        }
        if (!phone && href.startsWith("tel:")) {
          phone = href.replace("tel:", "");
        }
      });

      // Pick the best website URL (shortest path = homepage)
      let website = "";
      if (businessUrls.length > 0) {
        const sorted = businessUrls
          .map((u) => {
            try {
              const parsed = new URL(u);
              return { url: u, origin: parsed.origin, pathLen: parsed.pathname.length };
            } catch {
              return { url: u, origin: u, pathLen: 999 };
            }
          })
          .sort((a, b) => a.pathLen - b.pathLen);
        website = sorted[0].origin;
      }

      console.log(`    -> ${name} | web: ${website || "NONE"} | email: ${email || "-"} | phone: ${phone || "-"}`);

      if (name && (website || email || phone)) {
        results.push({ name, url: website || "", email, phone });
      }
    } catch (e) {
      console.log(`    -> ERROR: ${e instanceof Error ? e.message : e}`);
    }
  }

  // Add any JSON-extracted results that aren't already found
  for (const jr of jsonResults) {
    if (results.length >= 6) break;
    const domain = getDomain(jr.url);
    if (!results.some((r) => getDomain(r.url) === domain)) {
      results.push(jr);
    }
  }

  return results;
}

async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + " website")}`;
  console.log(`  [DDG] URL: ${url}`);

  const res = await axios.get(url, HTTP);
  const $ = cheerio.load(res.data);
  const results: SearchResult[] = [];

  console.log(`  [DDG] .result count: ${$(".result").length}`);

  $(".result").each((_, el) => {
    if (results.length >= 6) return;
    const title = $(el).find(".result__title a").text().trim();
    let href = $(el).find(".result__title a").attr("href") || "";

    const match = href.match(/uddg=([^&]+)/);
    if (match) {
      href = decodeURIComponent(match[1]);
    }

    if (title && href.startsWith("http") && isBusinessUrl(href)) {
      console.log(`  [DDG] Found: ${title.substring(0, 50)} | ${href.substring(0, 60)}`);
      results.push({ name: title, url: href, email: "", phone: "" });
    }
  });

  return results;
}
