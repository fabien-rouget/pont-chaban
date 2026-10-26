import { addDays, dateKeyOf, parisToInstant } from './time';

/** Enregistrement brut du jeu « previsions_pont_chaban ». */
export interface RawRecord {
  bateau?: string | null;
  date_passage?: string | null;
  fermeture_a_la_circulation?: string | null;
  re_ouverture_a_la_circulation?: string | null;
  type_de_fermeture?: string | null;
  fermeture_totale?: string | null;
}

export interface Closure {
  id: string;
  /** Libellé source (ex. « MARATHON DE BORDEAUX »). */
  label: string;
  /** Date de passage « AAAA-MM-JJ » (jour de la fermeture). */
  dateKey: string;
  /** Heures murales « HH:MM ». */
  startTime: string;
  endTime: string;
  /** Instants absolus (ms). */
  start: number;
  end: number;
  /** Vrai si la réouverture a lieu le lendemain. */
  overnight: boolean;
  /** Date « AAAA-MM-JJ » de la réouverture. */
  endDateKey: string;
  type: string;
}

const TIME_RE = /^\d{1,2}:\d{2}/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

function normTime(t: string): string {
  const [h, m] = t.slice(0, 5).split(':');
  return `${h.padStart(2, '0')}:${m}`;
}

/** Convertit un enregistrement ; renvoie null s'il est inexploitable. */
export function toClosure(r: RawRecord, index = 0): Closure | null {
  const date = r.date_passage?.trim();
  const from = r.fermeture_a_la_circulation?.trim();
  const to = r.re_ouverture_a_la_circulation?.trim();
  if (!date || !from || !to || !DATE_RE.test(date) || !TIME_RE.test(from) || !TIME_RE.test(to)) return null;
  const dateKey = date.slice(0, 10);
  const startTime = normTime(from);
  const endTime = normTime(to);
  // Réouverture avant (ou à) l'heure de fermeture → lendemain.
  const overnight = endTime <= startTime;
  const endDateKey = overnight ? addDays(dateKey, 1) : dateKey;
  const start = parisToInstant(dateKey, startTime);
  const end = parisToInstant(endDateKey, endTime);
  if (!(end > start)) return null;
  const label = (r.bateau ?? '').trim();
  const type = (r.type_de_fermeture ?? '').trim() || (r.fermeture_totale === 'oui' ? 'Totale' : '');
  return {
    id: `${dateKey}T${startTime}#${index}`,
    label,
    dateKey,
    startTime,
    endTime,
    start,
    end,
    overnight,
    endDateKey,
    type,
  };
}

export function toClosures(records: RawRecord[]): Closure[] {
  const out: Closure[] = [];
  records.forEach((r, i) => {
    const c = toClosure(r, i);
    if (c) out.push(c);
  });
  return out.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
}

/** Fermetures à afficher : jour de passage ≥ aujourd'hui, ou encore en cours (nuit commencée la veille). */
export function upcomingClosures(all: Closure[], now: number): Closure[] {
  const today = dateKeyOf(now);
  return all.filter((c) => c.dateKey >= today || c.end > now);
}

export type BridgeState = 'open' | 'closed';

export interface Status {
  state: BridgeState;
  /** Fermeture en cours (si fermé). */
  current: Closure | null;
  /** Instant de réouverture effective (fermetures contiguës fusionnées). */
  reopensAt: number | null;
  /** Prochaine fermeture à venir (hors fermeture en cours). */
  next: Closure | null;
}

/** État du pont déduit du planning. */
export function computeStatus(all: Closure[], now: number): Status {
  const current = all.find((c) => c.start <= now && now < c.end) ?? null;
  const next = all.find((c) => c.start > now) ?? null;
  if (!current) return { state: 'open', current: null, reopensAt: null, next };
  let reopensAt = current.end;
  for (const c of all) {
    if (c.start <= reopensAt && c.end > reopensAt) reopensAt = c.end;
  }
  const following = all.find((c) => c.start > reopensAt) ?? null;
  return { state: 'closed', current, reopensAt, next: following };
}

/** « Marathon de Bordeaux », « Maintenance » : met en forme les libellés tout en majuscules. */
export function prettyLabel(label: string): string {
  if (!label) return 'Fermeture programmée';
  if (label !== label.toUpperCase()) return label;
  const small = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'd', 'l']);
  return label
    .toLowerCase()
    .split(/(\s+|-|')/)
    .map((w, i) => (i === 0 || !small.has(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join('');
}

/** Libellé générique du type (ne casse pas si de nouvelles valeurs apparaissent). */
export function typeLabel(type: string): string {
  return type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Non précisé';
}
