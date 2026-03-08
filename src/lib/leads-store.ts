import Redis from "ioredis";
import { Lead } from "./types";

const LEADS_KEY = "leads";

function getRedis() {
  return new Redis(process.env.REDIS_URL || "", {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
}

export async function getLeads(): Promise<Lead[]> {
  const redis = getRedis();
  try {
    const data = await redis.get(LEADS_KEY);
    return data ? JSON.parse(data) : [];
  } finally {
    redis.disconnect();
  }
}

export async function saveLead(lead: Lead) {
  const redis = getRedis();
  try {
    const leads = await getLeadsWithRedis(redis);
    const existing = leads.findIndex((l) => l.url === lead.url);
    if (existing >= 0) {
      leads[existing] = { ...leads[existing], ...lead };
    } else {
      leads.push(lead);
    }
    await redis.set(LEADS_KEY, JSON.stringify(leads));
  } finally {
    redis.disconnect();
  }
}

export async function updateLead(id: string, updates: Partial<Lead>) {
  const redis = getRedis();
  try {
    const leads = await getLeadsWithRedis(redis);
    const index = leads.findIndex((l) => l.id === id);
    if (index >= 0) {
      leads[index] = { ...leads[index], ...updates };
      await redis.set(LEADS_KEY, JSON.stringify(leads));
    }
  } finally {
    redis.disconnect();
  }
}

export async function deleteLead(id: string) {
  const redis = getRedis();
  try {
    const leads = await getLeadsWithRedis(redis);
    const filtered = leads.filter((l) => l.id !== id);
    await redis.set(LEADS_KEY, JSON.stringify(filtered));
  } finally {
    redis.disconnect();
  }
}

async function getLeadsWithRedis(redis: Redis): Promise<Lead[]> {
  const data = await redis.get(LEADS_KEY);
  return data ? JSON.parse(data) : [];
}
