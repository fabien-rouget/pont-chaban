import { dateKeyOf, addDays } from './time';
import type { RawRecord } from './closures';

const BASE = 'https://datahub.bordeaux-metropole.fr/api/explore/v2.1/catalog/datasets/previsions_pont_chaban';
const CACHE_KEY = 'pont-chaban:data:v1';
const PAGE = 100;

export interface Snapshot {
  records: RawRecord[];
  /** `metas.default.data_processed` (ISO), si connu. */
  processedAt: string | null;
  /** Instant (ms) où ces données ont été récupérées. */
  fetchedAt: number;
}

export interface LoadResult {
  snapshot: Snapshot;
  /** Vrai si le réseau a échoué et que le cache est utilisé. */
  offline: boolean;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function recordsUrl(yesterday: string, offset: number): string {
  const q = new URLSearchParams({
    where: `date_passage>=date'${yesterday}'`,
    order_by: 'date_passage,fermeture_a_la_circulation',
    limit: String(PAGE),
    offset: String(offset),
  });
  return `${BASE}/records?${q}`;
}

export async function fetchRecords(now: number, signal?: AbortSignal): Promise<RawRecord[]> {
  const yesterday = addDays(dateKeyOf(now), -1);
  const out: RawRecord[] = [];
  for (let offset = 0; offset < 2000; offset += PAGE) {
    const page = await getJson<{ total_count?: number; results?: RawRecord[] }>(recordsUrl(yesterday, offset), signal);
    const results = page.results ?? [];
    out.push(...results);
    if (results.length < PAGE || out.length >= (page.total_count ?? 0)) break;
  }
  return out;
}

export async function fetchProcessedAt(signal?: AbortSignal): Promise<string | null> {
  const meta = await getJson<{ metas?: { default?: { data_processed?: string } } }>(BASE, signal);
  return meta.metas?.default?.data_processed ?? null;
}

export function readCache(): Snapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Snapshot;
    return Array.isArray(s.records) && typeof s.fetchedAt === 'number' ? s : null;
  } catch {
    return null;
  }
}

function writeCache(s: Snapshot): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(s));
  } catch {
    /* stockage indisponible : on continue sans cache */
  }
}

/** Réseau d'abord ; repli sur le dernier instantané en cache. Renvoie null si rien n'est disponible. */
export async function load(now = Date.now()): Promise<LoadResult | null> {
  const cached = readCache();
  try {
    const signal = AbortSignal.timeout(12_000);
    const [records, processedAt] = await Promise.all([
      fetchRecords(now, signal),
      fetchProcessedAt(signal).catch(() => cached?.processedAt ?? null),
    ]);
    const snapshot: Snapshot = { records, processedAt, fetchedAt: now };
    writeCache(snapshot);
    return { snapshot, offline: false };
  } catch {
    return cached ? { snapshot: cached, offline: true } : null;
  }
}

export const DATASET_URL =
  'https://datahub.bordeaux-metropole.fr/explore/dataset/previsions_pont_chaban/information/';
export const OFFICIAL_URL = 'https://sedeplacer.bordeaux-metropole.fr/previsions-fermetures-pont-chaban-delmas';
