import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Map technical problems to client-facing language by sector
const PROBLEM_TRANSLATIONS: Record<string, Record<string, string>> = {
  restaurant: {
    "no mobile": "Gaeste suchen am Smartphone nach Restaurants, Oeffnungszeiten und Speisekarten",
    "lenta": "Wenn die Seite langsam laedt, springen viele Gaeste ab",
    "sin ssl": "Ohne HTTPS-Verschluesselung warnen manche Browser Ihre Besucher",
    "sin cta": "Gaeste finden nicht sofort, wie sie reservieren oder Sie kontaktieren koennen",
    "sin seo": "Ihre Seite wird bei Google schwerer gefunden, wenn Leute nach Restaurants in der Naehe suchen",
    "antigua": "Die Seite wirkt etwas in die Jahre gekommen — das kann Gaeste abschrecken",
  },
  default: {
    "no mobile": "Viele Kunden schauen heute zuerst am Smartphone — Ihre Seite wird dort nicht optimal angezeigt",
    "lenta": "Ihre Website laedt relativ langsam, das kann Besucher abschrecken",
    "sin ssl": "Ohne HTTPS warnen manche Browser Ihre Besucher vor der Seite",
    "sin cta": "Besucher finden nicht sofort, wie sie Sie kontaktieren koennen",
    "sin seo": "Ihre Seite ist bei Google schwerer zu finden als noetig",
    "antigua": "Der Webauftritt wirkt etwas veraltet — ein moderneres Design koennte mehr Kunden ansprechen",
  },
};

function translateProblem(problem: string, sector: string): string {
  const p = problem.toLowerCase();
  const sectorMap = PROBLEM_TRANSLATIONS[sector.toLowerCase()] || PROBLEM_TRANSLATIONS.default;
  const defMap = PROBLEM_TRANSLATIONS.default;

  if (p.includes("viewport") || p.includes("mobile")) return sectorMap["no mobile"] || defMap["no mobile"];
  if (p.includes("lenta") || p.includes("slow")) return sectorMap["lenta"] || defMap["lenta"];
  if (p.includes("ssl") || p.includes("https")) return sectorMap["sin ssl"] || defMap["sin ssl"];
  if (p.includes("cta") || p.includes("accion")) return sectorMap["sin cta"] || defMap["sin cta"];
  if (p.includes("seo") || p.includes("titulo") || p.includes("description")) return sectorMap["sin seo"] || defMap["sin seo"];
  if (p.includes("antigua") || p.includes("doctype") || p.includes("joomla") || p.includes("flash") || p.includes("tabla")) return sectorMap["antigua"] || defMap["antigua"];
  return "";
}

function getClientProblems(problems: string[], sector: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const p of problems) {
    const translated = translateProblem(p, sector);
    if (translated && !seen.has(translated)) {
      seen.add(translated);
      result.push(translated);
    }
  }
  return result.slice(0, 2); // max 2 problems
}

export async function generateEmail(
  businessName: string,
  city: string,
  sector: string,
  problems: string[]
): Promise<string> {
  const clientProblems = getClientProblems(problems, sector);
  const problemText = clientProblems.length > 0
    ? clientProblems.join(". Ausserdem: ")
    : "der Webauftritt wirkt etwas veraltet";

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `Du bist Roberto Salvador, Webentwickler aus Sevelen. Du schreibst wie ein netter Nachbar — locker, ehrlich, herzlich. Kein Verkaeufer, kein Berater, einfach ein freundlicher Typ aus dem Dorf der sich mit Websites auskennt.

SCHREIBE EINE SEHR KURZE, WARME EMAIL. Maximal 5-6 Saetze. Wie eine WhatsApp-Nachricht, nur als Email.

BEISPIEL (genau dieser Stil):

Betreff: Kurzer Hinweis zu Ihrer Website

Grüezi mitenand

Ich bin der Roberto aus Sevelen — ich mache Websites fuer Betriebe hier in der Region.

Ich habe mir neulich Ihre Seite angeschaut und mir ist aufgefallen, dass [PROBLEM IN EINFACHEN WORTEN].

Das ist schade, weil [WARUM ES DEM KUNDEN SCHADET — Gaeste, Kunden, Handy, Google].

Wenn Sie moegen, schaue ich mir das gerne mal kurz an — ganz unverbindlich, 5-10 Minuten am Telefon reichen.

Ich freue mich, von Ihnen zu hoeren!

Liebe Grüsse
Roberto

Lweb — Moderne Websites & Apps
+41 76 560 86 45
info@lweb.ch
https://www.lweb.ch
Sevelen

REGELN:
- Schreibe wie ein Nachbar, NICHT wie eine Firma. Locker, warm, menschlich.
- "Grüezi mitenand" oder "Grüezi" — NIEMALS "Sehr geehrte Damen und Herren"
- "Liebe Grüsse" oder "Herzliche Grüsse" — NICHT "Freundliche Grüsse" oder "Mit freundlichen Grüssen"
- Unterschreibe nur mit "Roberto" — NICHT "Roberto Salvador"
- Du-Form vermeiden, aber trotzdem nahbar (Sie, aber warm)
- GENAU so kurz wie das Beispiel. NICHT laenger.
- Schweizer Hochdeutsch ("ss" statt "ß", "Grüsse" nicht "Grüße")
- KEINE technischen Begriffe
- Sprich ueber Kunden, Gaeste, Handy, Google — was den Betrieb interessiert
- KEIN Verkaufsdruck
- Betreff: simpel und kurz
- Die Unterschrift immer genau wie im Beispiel (mit "Roberto", nicht vollem Namen)
`,
      },
      {
        role: "user",
        content: `Email an "${businessName}", ein ${sector} in ${city}.
Hauptproblem fuer den Kunden: ${problemText}.`,
      },
    ],
    temperature: 0.7,
  });

  return response.choices[0].message.content || "";
}
