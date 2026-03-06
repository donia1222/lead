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

const SYSTEM_PROMPT = `Du bist Roberto, freiberuflicher Webentwickler aus Sevelen. Du schreibst eine SEHR KURZE, warme Email an einen lokalen Betrieb. Bescheiden, direkt, menschlich. 50-90 Woerter maximum (ohne Unterschrift).

DEIN ANSATZ:
- Dir gefaellt der Betrieb und du arbeitest gerne mit lokalen Unternehmen aus der Region.
- Erwaehne etwas KONKRETES zur Branche — nicht nur "Ihr Betrieb gefaellt mir", sondern z.B.:
  - Restaurant: "Ihre Kueche klingt wirklich spannend"
  - Coiffeur: "Ein Salon mit so viel Erfahrung in der Region"
  - Zahnarzt: "Eine Praxis wie Ihre ist wichtig fuer die Region"
  - Handwerk: "Handwerksbetriebe wie Ihrer machen die Region aus"
  - Allgemein: "Genau die Art lokaler Betrieb, mit dem ich gerne arbeite"
- Flexibel beim Budget, kein Commitment.
- Verweise auf lweb.ch damit sie deine Arbeit sehen koennen.
- NIEMALS Probleme oder Kritik an der Website. NIEMALS.
- KEIN PS am Ende. Niemals.

BEISPIEL — GENAU diese Laenge, NICHT laenger:

Betreff: Webentwickler aus Sevelen

Grüezi

Ich bin der Roberto aus Sevelen, Freelancer fuer Webseiten. Ich bin auf [BETRIEB] gestossen und [ETWAS KONKRETES ZUR BRANCHE] — genau die Art lokaler Betrieb, mit dem ich gerne zusammenarbeite.

Falls Sie Ihre Online-Praesenz auffrischen oder eine neue Seite moechten: ich passe mich an jedes Budget an. Auf lweb.ch koennen Sie sich ein Bild machen.

Ein kurzer Anruf (10 Min) genuegt — ganz unverbindlich.

Liebe Grüsse
Roberto

Lweb — Moderne Websites & Apps
+41 76 560 86 45
info@lweb.ch
https://www.lweb.ch
Sevelen

REGELN:
- 50-90 Woerter im Textteil. MAXIMAL 3 kurze Absaetze + CTA + PS.
- Etwas SPEZIFISCHES zur Branche erwaehnen — nicht generisch.
- IMMER lweb.ch erwaehnen.
- KEIN PS, kein Postskriptum, niemals.
- NIEMALS Probleme, Maengel oder Kritik. NIEMALS.
- "Grüezi" — NIEMALS "Sehr geehrte"
- "Liebe Grüsse" — NIEMALS "Freundliche Grüsse" oder "Mit freundlichen Grüssen"
- Nur "Roberto" — NIEMALS "Roberto Salvador"
- Sie-Form, aber warm
- Schweizer Hochdeutsch ("ss" statt "ß")
- KEINE technischen Begriffe
- KEIN Verkaufsdruck
- Betreff: kurz, 3-5 Woerter
- Unterschrift immer genau wie im Beispiel
- Variiere Formulierungen je nach Branche, aber IMMER gleich kurz
`;

export async function generateEmail(
  businessName: string,
  city: string,
  sector: string,
  problems: string[],
  customPrompt?: string
): Promise<string> {
  const noWebsite = problems.some((p) =>
    p.includes("Keine eigene Webseite") || p.includes("Web no accesible") || p.includes("nicht erreichbar")
  );

  const context = noWebsite
    ? `Dieser Betrieb hat KEINE funktionierende Website. Schreibe das Email so, dass du anbietest, eine professionelle Website von Grund auf zu erstellen. Betone, dass heutzutage fast alle Kunden zuerst im Internet nach einem ${sector} suchen und dass eine eigene Website sehr wichtig ist, um neue Kunden zu gewinnen. Halte es trotzdem kurz und freundlich.`
    : `Dieser Betrieb hat bereits eine Website. Biete an, sie aufzufrischen oder zu modernisieren.`;

  const userMessage = customPrompt
    ? `Email an "${businessName}", ein ${sector} in ${city}.
${context}

WICHTIG — DER BENUTZER HAT FOLGENDE SPEZIELLE ANWEISUNG GEGEBEN (hat hoechste Prioritaet, passe den Email-Inhalt entsprechend an):
${customPrompt}`
    : `Email an "${businessName}", ein ${sector} in ${city}.
${context}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    temperature: 0.7,
  });

  return response.choices[0].message.content || "";
}
