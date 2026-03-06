import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { updateLead } from "@/lib/leads-store";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const LANG_NAMES: Record<string, string> = {
  de: "Deutsch (Schweizer Hochdeutsch, ss statt ß)",
  es: "Español",
  en: "English",
  it: "Italiano",
  fr: "Français",
};

export async function POST(req: NextRequest) {
  const { id, email, lang } = await req.json();

  if (!email || !lang) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const langName = LANG_NAMES[lang] || lang;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `Traduce el siguiente email a ${langName}. Mantén el mismo tono cercano, cálido y informal. Mantén la firma exactamente igual (nombre, empresa, teléfono, email, URL, ciudad). No añadas ni quites contenido, solo traduce.`,
        },
        { role: "user", content: email },
      ],
      temperature: 0.3,
    });

    const translated = response.choices[0].message.content || "";

    if (id) {
      updateLead(id, { emailDraft: translated });
    }

    return NextResponse.json({ email: translated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
