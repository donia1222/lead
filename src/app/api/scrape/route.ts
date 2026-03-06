import { NextRequest, NextResponse } from "next/server";
import { scrapeWebsite, calculateScore } from "@/lib/scraper";
import { saveLead } from "@/lib/leads-store";
import { Lead } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { name, sector, city, url } = await req.json();

  if (!url || !name) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const data = await scrapeWebsite(url);
  const score = calculateScore(data);

  const lead: Lead = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
    name,
    sector: sector || "",
    city: city || "",
    url,
    email: data.emails[0] || "",
    phone: data.phones[0] || "",
    contactPage: data.contactPage,
    hasSSL: data.hasSSL,
    hasViewport: data.hasViewport,
    loadTime: data.loadTime,
    score,
    problems: data.problems,
    status: "new",
    emailDraft: "",
    createdAt: new Date().toISOString(),
  };

  saveLead(lead);

  return NextResponse.json(lead);
}
