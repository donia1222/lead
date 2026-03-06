import axios from "axios";
import * as cheerio from "cheerio";

export interface SearchResult {
  name: string;
  url: string;
  email: string;
  phone: string;
}

const HTTP = {
  timeout: 10000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
};

// Domains to ignore (directories, social media, etc)
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
  const results: SearchResult[] = [];

  // 1. Search on local.ch (best source for Swiss businesses)
  try {
    const localResults = await searchLocalCh(query);
    results.push(...localResults);
  } catch {
    console.log("local.ch search failed");
  }

  // 2. Fallback: DuckDuckGo for direct business websites
  if (results.length < 6) {
    try {
      const ddgResults = await searchDuckDuckGo(query);
      results.push(...ddgResults);
    } catch {
      console.log("DuckDuckGo search failed");
    }
  }

  // Deduplicate by domain
  const seen = new Set<string>();
  return results.filter((r) => {
    const domain = getDomain(r.url);
    if (seen.has(domain)) return false;
    seen.add(domain);
    return true;
  });
}

async function searchLocalCh(query: string): Promise<SearchResult[]> {
  // Split query into what/where for local.ch URL format
  const parts = query.trim().split(/\s+/);
  const what = parts[0];
  const where = parts.slice(1).join(" ") || "";

  const url = `https://www.local.ch/de/q/${encodeURIComponent(where)}/${encodeURIComponent(what)}`;
  const res = await axios.get(url, HTTP);
  const $ = cheerio.load(res.data);

  // Collect detail page links from listings
  const detailLinks: { name: string; path: string }[] = [];

  $('a[href*="/de/d/"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().trim();
    if (
      href.startsWith("/de/d/") &&
      text.length > 2 &&
      text.length < 80 &&
      !text.includes("Bewertung") &&
      !text.includes("Eintrag")
    ) {
      const already = detailLinks.some((d) => d.path === href);
      if (!already) {
        detailLinks.push({ name: text, path: href });
      }
    }
  });

  // Visit each detail page to get website, email, phone (max 10 to find 6 with websites)
  const results: SearchResult[] = [];
  for (const entry of detailLinks.slice(0, 10)) {
    if (results.length >= 6) break;

    try {
      await new Promise((r) => setTimeout(r, 800));
      const detailUrl = "https://www.local.ch" + entry.path;
      const detailRes = await axios.get(detailUrl, HTTP);
      const d = cheerio.load(detailRes.data);

      const name = d("h1").text().trim() || entry.name;
      let website = "";
      let email = "";
      let phone = "";

      d("a").each((_, a) => {
        const href = d(a).attr("href") || "";
        if (!website && isBusinessUrl(href)) {
          // Get the main website (usually the shortest/cleanest URL)
          const clean = href.replace(/\/$/, "");
          if (!clean.includes("/index.php") && !clean.includes("/menu")) {
            website = href;
          } else if (!website) {
            // Extract base domain
            try {
              const u = new URL(href);
              website = u.origin;
            } catch {
              website = href;
            }
          }
        }
        if (!email && href.startsWith("mailto:")) {
          email = href.replace("mailto:", "");
        }
        if (!phone && href.startsWith("tel:")) {
          phone = href.replace("tel:", "");
        }
      });

      if (website) {
        results.push({ name, url: website, email, phone });
      }
    } catch {
      // Skip failed detail pages
    }
  }

  return results;
}

async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + " website")}`;
  const res = await axios.get(url, HTTP);
  const $ = cheerio.load(res.data);
  const results: SearchResult[] = [];

  $(".result").each((_, el) => {
    if (results.length >= 6) return;
    const title = $(el).find(".result__title a").text().trim();
    let href = $(el).find(".result__title a").attr("href") || "";

    // DuckDuckGo wraps URLs - extract the real URL
    const match = href.match(/uddg=([^&]+)/);
    if (match) {
      href = decodeURIComponent(match[1]);
    }

    if (title && href.startsWith("http") && isBusinessUrl(href)) {
      results.push({ name: title, url: href, email: "", phone: "" });
    }
  });

  return results;
}
