import { NextResponse } from "next/server";
import { getLeads } from "@/lib/leads-store";

export async function GET() {
  const leads = getLeads();

  const header = "Nombre,Sector,Ciudad,Web,Email,Telefono,Score,Estado,Problemas\n";
  const rows = leads
    .map(
      (l) =>
        `"${l.name}","${l.sector}","${l.city}","${l.url}","${l.email}","${l.phone}",${l.score},"${l.status}","${l.problems.join("; ")}"`
    )
    .join("\n");

  const csv = header + rows;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=leads.csv",
    },
  });
}
