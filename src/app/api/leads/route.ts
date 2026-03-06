import { NextRequest, NextResponse } from "next/server";
import { getLeads, updateLead, deleteLead } from "@/lib/leads-store";

export async function GET() {
  const leads = getLeads();
  return NextResponse.json(leads);
}

export async function PATCH(req: NextRequest) {
  const { id, ...updates } = await req.json();
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  updateLead(id, updates);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  deleteLead(id);
  return NextResponse.json({ ok: true });
}
