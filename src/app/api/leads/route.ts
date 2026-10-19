import { NextRequest, NextResponse } from "next/server";
import { getLeads, updateLead, updateLeads, deleteLead, deleteLeads } from "@/lib/leads-store";

export async function GET() {
  const leads = await getLeads();
  return NextResponse.json(leads);
}

export async function PATCH(req: NextRequest) {
  const { id, ids, ...updates } = await req.json();
  // Varios de golpe cuando vienen marcados de la lista; uno solo, como siempre.
  if (Array.isArray(ids)) {
    if (!ids.length) return NextResponse.json({ error: "Faltan ids" }, { status: 400 });
    const n = await updateLeads(ids.map(String), updates);
    return NextResponse.json({ ok: true, cambiados: n });
  }
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  await updateLead(id, updates);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id, ids } = await req.json();
  if (Array.isArray(ids)) {
    if (!ids.length) return NextResponse.json({ error: "Faltan ids" }, { status: 400 });
    const n = await deleteLeads(ids.map(String));
    return NextResponse.json({ ok: true, borrados: n });
  }
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  await deleteLead(id);
  return NextResponse.json({ ok: true });
}
