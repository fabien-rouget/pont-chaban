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

/** Cause d'un échec : `source` = le service de Bordeaux Métropole répond en erreur (panne), `timeout` = il ne répond pas dans le délai, `network` = pas de connexion. */
export type FailReason = 'source' | 'timeout' | 'network';

/** Délai maximal d'attente de chaque requête. */
export const REQUEST_TIMEOUT_MS = 10_000;

export interface LoadResult {
  /** Dernières données disponibles (réseau ou cache), null s'il n'y en a aucune. */
  snapshot: Snapshot | null;
  /** Vrai si le réseau/l'API a échoué (le cache éventuel est alors utilisé). */
  offline: boolean;
  reason?: FailReason;
}

class HttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}


async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), headers: { Accept: 'application/json' } });
  if (!res.ok) throw new HttpError(res.status);
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

export async function fetchRecords(now: number): Promise<RawRecord[]> {
  const yesterday = addDays(dateKeyOf(now), -1);
  const out: RawRecord[] = [];
  for (let offset = 0; offset < 2000; offset += PAGE) {
    const page = await getJson<{ total_count?: number; results?: RawRecord[] }>(recordsUrl(yesterday, offset));
    const results = page.results ?? [];
    out.push(...results);
    if (results.length < PAGE || out.length >= (page.total_count ?? 0)) break;
  }
  return out;
}

export async function fetchProcessedAt(): Promise<string | null> {
  const meta = await getJson<{ metas?: { default?: { data_processed?: string } } }>(BASE);
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

/**
 * Réseau d'abord ; repli sur le dernier instantané en cache.
 * Un navigateur qui ne peut pas lire une réponse d'erreur (502 sans en-tête CORS) lève une erreur réseau :
 * on ne distingue alors une panne de la source d'une coupure réseau que si `navigator.onLine` le permet.
 */
export async function load(now = Date.now()): Promise<LoadResult> {
  const cached = readCache();
  try {
    const [records, processedAt] = await Promise.all([
      fetchRecords(now),
      fetchProcessedAt().catch(() => cached?.processedAt ?? null),
    ]);
    const snapshot: Snapshot = { records, processedAt, fetchedAt: now };
    writeCache(snapshot);
    return { snapshot, offline: false };
  } catch (e) {
    const online = typeof navigator === 'undefined' || navigator.onLine !== false;
    const timedOut = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError');
    const reason: FailReason = e instanceof HttpError ? 'source' : timedOut && online ? 'timeout' : online ? 'source' : 'network';
    return { snapshot: cached, offline: true, reason };
  }
}

export const DATASET_URL =
  'https://datahub.bordeaux-metropole.fr/explore/dataset/previsions_pont_chaban/information/';
export const OFFICIAL_URL = 'https://sedeplacer.bordeaux-metropole.fr/previsions-fermetures-pont-chaban-delmas';
