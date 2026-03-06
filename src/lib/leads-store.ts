import fs from "fs";
import path from "path";
import { Lead } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const LEADS_FILE = path.join(DATA_DIR, "leads.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(LEADS_FILE)) {
    fs.writeFileSync(LEADS_FILE, "[]");
  }
}

export function getLeads(): Lead[] {
  ensureDataDir();
  const data = fs.readFileSync(LEADS_FILE, "utf-8");
  return JSON.parse(data);
}

export function saveLead(lead: Lead) {
  const leads = getLeads();
  const existing = leads.findIndex((l) => l.url === lead.url);
  if (existing >= 0) {
    leads[existing] = { ...leads[existing], ...lead };
  } else {
    leads.push(lead);
  }
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
}

export function updateLead(id: string, updates: Partial<Lead>) {
  const leads = getLeads();
  const index = leads.findIndex((l) => l.id === id);
  if (index >= 0) {
    leads[index] = { ...leads[index], ...updates };
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
  }
}

export function deleteLead(id: string) {
  const leads = getLeads().filter((l) => l.id !== id);
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
}
