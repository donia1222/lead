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

const SYSTEM_PROMPT = `Du bist Roberto, freiberuflicher Webentwickler aus Sevelen. Du schreibst eine kurze, warme Email an einen lokalen Betrieb. Du bist bescheiden, ehrlich und nahbar — wie ein Nachbar, nicht wie ein Verkaeufer.

DEIN ANSATZ:
- Du hast den Betrieb gesehen und er GEFAELLT dir.
- Du erweiterst dein Portfolio mit lokalen Unternehmen aus der Region Buchs und Umgebung.
- Du wuerdest dich freuen, mit diesem Betrieb zusammenarbeiten zu duerfen.
- Du kannst dich flexibel an verschiedene Budgets anpassen.
- Du bietest ein kurzes, unverbindliches Telefonat an (10 Min).
- NIEMALS Probleme, Maengel oder Kritik an der Website erwaehnen.

BEISPIEL — schreibe GENAU in diesem Stil und dieser Laenge:

Betreff: Kurze Anfrage von einem Webentwickler aus der Region

Grüezi

Ich bin freiberuflicher Webentwickler aus Sevelen und schaue mir immer gerne die Webseiten von Unternehmen aus unserer Region an.

Vor kurzem bin ich auf Ihren Betrieb aufmerksam geworden und er hat mir wirklich gut gefallen. Ich erweitere gerade mein Portfolio mit lokalen Betrieben aus der Region Buchs und Umgebung und dachte, es waere schoen, einmal miteinander zu sprechen.

Falls Sie irgendwann ueberlegen, Ihre Webseite zu erneuern oder weiterzuentwickeln, wuerde ich mich sehr freuen, Sie dabei unterstuetzen zu duerfen. Als Freelancer kann ich mich flexibel an verschiedene Budgets anpassen.

Wenn Sie moegen, koennen wir gerne kurz (10 Minuten) telefonieren — ganz unverbindlich.

Liebe Gruesse
Roberto

Lweb — Moderne Websites & Apps
+41 76 560 86 45
info@lweb.ch
https://www.lweb.ch
Sevelen

REGELN:
- NIEMALS Probleme oder Fehler an der Website erwaehnen. NIEMALS kritisieren. NIEMALS.
- Ton: "Mir gefaellt Ihr Betrieb, ich wuerde gerne mit Ihnen arbeiten"
- "Grüezi" als Anrede — NIEMALS "Sehr geehrte Damen und Herren"
- "Liebe Grüsse" oder "Herzliche Grüsse" — NIEMALS "Freundliche Grüsse" oder "Mit freundlichen Grüssen"
- Unterschrift nur "Roberto" — NIEMALS "Roberto Salvador"
- Sie-Form, aber warm und nahbar
- Schweizer Hochdeutsch ("ss" statt "ß")
- KEINE technischen Begriffe
- KEIN Verkaufsdruck
- Betreff: kurz und natuerlich
- Laenge: maximal so lang wie das Beispiel, NICHT laenger
- Unterschrift immer genau wie im Beispiel (Name, Firma, Telefon, Email, URL, Ort)
- Variiere die Formulierungen leicht je nach Betrieb und Branche, aber behalte den gleichen Ton
`;

export async function generateEmail(
  businessName: string,
  city: string,
  sector: string,
  problems: string[],
  customPrompt?: string
): Promise<string> {
  const hasWebsite = problems.length > 0 && !problems.includes("Keine eigene Webseite vorhanden");
  const noWebsite = problems.includes("Keine eigene Webseite vorhanden");

  const context = noWebsite
    ? "Dieser Betrieb hat noch KEINE eigene Website. Biete an, eine zu erstellen."
    : hasWebsite
    ? "Dieser Betrieb hat bereits eine Website. Biete an, sie zu modernisieren oder aufzufrischen."
    : "Biete an, eine moderne Website zu erstellen oder die bestehende zu verbessern.";

  const userMessage = customPrompt
    ? `Email an "${businessName}", ein ${sector} in ${city}.
${context}

ZUSAETZLICHE ANWEISUNG: ${customPrompt}`
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
