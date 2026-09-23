import { promises as fs } from "fs";
import path from "path";
import { Lead } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const LEADS_FILE = path.join(DATA_DIR, "leads.json");

// Serialize writes so concurrent requests don't overwrite each other.
let queue: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

async function readLeads(): Promise<Lead[]> {
  try {
    const data = await fs.readFile(LEADS_FILE, "utf-8");
    return data ? JSON.parse(data) : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function writeLeads(leads: Lead[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${LEADS_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(leads, null, 2));
  await fs.rename(tmp, LEADS_FILE);
}

export async function getLeads(): Promise<Lead[]> {
  return readLeads();
}

export async function saveLead(lead: Lead) {
  return withLock(async () => {
    const leads = await readLeads();
    const existing = leads.findIndex((l) => l.url === lead.url);
    if (existing >= 0) {
      leads[existing] = { ...leads[existing], ...lead };
    } else {
      leads.push(lead);
    }
    await writeLeads(leads);
  });
}

export async function updateLead(id: string, updates: Partial<Lead>) {
  return withLock(async () => {
    const leads = await readLeads();
    const index = leads.findIndex((l) => l.id === id);
    if (index >= 0) {
      leads[index] = { ...leads[index], ...updates };
      await writeLeads(leads);
    }
  });
}

export async function deleteLead(id: string) {
  return withLock(async () => {
    const leads = await readLeads();
    await writeLeads(leads.filter((l) => l.id !== id));
  });
}
