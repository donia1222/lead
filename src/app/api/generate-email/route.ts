import { NextRequest, NextResponse } from "next/server";
import { generateEmail } from "@/lib/ai";
import { updateLead } from "@/lib/leads-store";

export async function POST(req: NextRequest) {
  const { id, name, city, sector, problems, customPrompt } = await req.json();

  if (!name) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  try {
    const email = await generateEmail(name, city, sector, problems, customPrompt);
    if (id) {
      updateLead(id, { emailDraft: email });
    }
    return NextResponse.json({ email });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
