import axios from "axios";
import * as cheerio from "cheerio";

export interface ScrapedData {
  emails: string[];
  phones: string[];
  contactPage: string;
  hasSSL: boolean;
  hasViewport: boolean;
  loadTime: number;
  problems: string[];
}

const HTTP_CONFIG = {
  timeout: 10000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
};

export async function scrapeWebsite(url: string): Promise<ScrapedData> {
  const problems: string[] = [];

  if (!url.startsWith("http")) {
    url = "https://" + url;
  }

  const hasSSL = url.startsWith("https");
  if (!hasSSL) problems.push("Sin SSL (no https)");

  const start = Date.now();
  let html = "";

  try {
    const res = await axios.get(url, HTTP_CONFIG);
    html = res.data;
  } catch {
    return {
      emails: [],
      phones: [],
      contactPage: "",
      hasSSL,
      hasViewport: false,
      loadTime: 0,
      problems: ["Web no accesible"],
    };
  }

  const loadTime = Date.now() - start;
  if (loadTime > 3000) problems.push("Web lenta (" + loadTime + "ms)");

  const $ = cheerio.load(html);

  // --- Extract emails ---
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g;
  const allEmails = new Set(
    (html.match(emailRegex) || []).filter(
      (e) =>
        !e.includes(".png") &&
        !e.includes(".jpg") &&
        !e.includes(".gif") &&
        !e.includes("@2x") &&
        !e.includes("@sentry") &&
        !e.includes("@media")
    )
  );

  // --- Extract Swiss phone numbers ---
  const phoneRegex = /(\+41|0)\s?\d{2}\s?\d{3}\s?\d{2}\s?\d{2}/g;
  const allPhones = new Set(html.match(phoneRegex) || []);

  // --- Find contact/impressum page and scrape it too ---
  let contactPage = "";
  const contactLinks: string[] = [];

  $("a").each((_, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().toLowerCase();
    if (
      text.includes("kontakt") ||
      text.includes("contact") ||
      text.includes("impressum") ||
      text.includes("uber uns") ||
      text.includes("ueber uns") ||
      href.includes("kontakt") ||
      href.includes("contact") ||
      href.includes("impressum")
    ) {
      let fullUrl = href;
      if (href.startsWith("/")) {
        const base = new URL(url);
        fullUrl = base.origin + href;
      } else if (!href.startsWith("http")) {
        fullUrl = url.replace(/\/$/, "") + "/" + href;
      }
      contactLinks.push(fullUrl);
      if (!contactPage) contactPage = fullUrl;
    }
  });

  // Visit contact/impressum pages for more emails and phones
  for (const link of contactLinks.slice(0, 2)) {
    try {
      await new Promise((r) => setTimeout(r, 500));
      const res2 = await axios.get(link, HTTP_CONFIG);
      const contactHtml: string = res2.data;
      const moreEmails = contactHtml.match(emailRegex) || [];
      const morePhones = contactHtml.match(phoneRegex) || [];
      moreEmails.forEach((e) => allEmails.add(e));
      morePhones.forEach((p) => allPhones.add(p));
    } catch {
      // skip
    }
  }

  // --- Check viewport (mobile-friendly) ---
  const hasViewport = html.includes("viewport");
  if (!hasViewport) problems.push("No es mobile-friendly (sin viewport)");

  // --- Analyze web quality in depth ---

  // Old HTML techniques
  if (html.includes("<table") && html.includes("bgcolor"))
    problems.push("Usa tablas HTML antiguas para layout");
  if (html.includes(".swf") || html.includes("flash"))
    problems.push("Usa Flash (obsoleto)");
  if (!html.includes("<!DOCTYPE html>") && !html.includes("<!doctype html>"))
    problems.push("Sin DOCTYPE moderno");

  // SEO problems
  const title = $("title").text().trim();
  if (!title) {
    problems.push("Sin titulo SEO");
  } else if (title.length < 10) {
    problems.push("Titulo SEO muy corto");
  }
  const metaDesc = $('meta[name="description"]').attr("content") || "";
  if (!metaDesc) problems.push("Sin meta description SEO");

  // No clear CTA
  const bodyText = $("body").text().toLowerCase();
  const hasCTA =
    bodyText.includes("jetzt") ||
    bodyText.includes("kontaktieren") ||
    bodyText.includes("termin") ||
    bodyText.includes("anfrage") ||
    bodyText.includes("buchen") ||
    bodyText.includes("bestellen") ||
    bodyText.includes("offerte");
  if (!hasCTA) problems.push("Sin llamada a la accion clara (CTA)");

  // No social media links
  const hasSocial =
    html.includes("facebook.com") ||
    html.includes("instagram.com") ||
    html.includes("linkedin.com") ||
    html.includes("twitter.com") ||
    html.includes("x.com");
  if (!hasSocial) problems.push("Sin redes sociales vinculadas");

  // Old CMS or no CMS
  const isWordPress = html.includes("wp-content");
  const isModernFramework =
    html.includes("__next") ||
    html.includes("__nuxt") ||
    html.includes("_nuxt") ||
    html.includes("react-root");
  const generator = $('meta[name="generator"]').attr("content") || "";

  if (isWordPress) {
    // Check WordPress version hints
    const wpVersion = html.match(/ver=(\d+\.\d+)/);
    if (wpVersion && parseFloat(wpVersion[1]) < 5) {
      problems.push("WordPress version antigua");
    }
  } else if (!isModernFramework && !generator) {
    problems.push("Sin CMS moderno detectado (web posiblemente hecha a mano)");
  }
  if (generator && generator.toLowerCase().includes("joomla")) {
    problems.push("Usa Joomla (CMS anticuado)");
  }
  if (generator && generator.toLowerCase().includes("typo3")) {
    // TYPO3 is common in Switzerland, not necessarily bad
  }

  // Inline styles (sign of old/messy code)
  const inlineStyles = (html.match(/style="/g) || []).length;
  if (inlineStyles > 20) problems.push("Demasiados estilos inline (codigo desordenado)");

  // No favicon
  const hasFavicon =
    $('link[rel="icon"]').length > 0 ||
    $('link[rel="shortcut icon"]').length > 0;
  if (!hasFavicon) problems.push("Sin favicon");

  // No cookie notice (GDPR/DSG)
  const hasCookieNotice =
    bodyText.includes("cookie") ||
    bodyText.includes("datenschutz") ||
    html.includes("cookiebot") ||
    html.includes("cookie-consent") ||
    html.includes("cookie-banner");
  if (!hasCookieNotice) problems.push("Sin aviso de cookies (posible problema DSG/GDPR)");

  // Images without alt text
  const imgsWithoutAlt = $("img").filter((_, el) => !$(el).attr("alt")).length;
  const totalImgs = $("img").length;
  if (totalImgs > 0 && imgsWithoutAlt > totalImgs / 2) {
    problems.push("Imagenes sin texto alternativo (malo para SEO y accesibilidad)");
  }

  // No contact email visible on main page
  if (allEmails.size === 0) {
    problems.push("Sin email de contacto visible");
  }

  return {
    emails: [...allEmails],
    phones: [...allPhones],
    contactPage,
    hasSSL,
    hasViewport,
    loadTime,
    problems,
  };
}

export function calculateScore(data: ScrapedData): number {
  let score = 0;
  if (!data.hasSSL) score += 20;
  if (!data.hasViewport) score += 20;
  if (data.loadTime > 3000) score += 10;
  // Each problem adds points (more problems = higher opportunity)
  score += data.problems.length * 7;
  return Math.min(score, 100);
}
