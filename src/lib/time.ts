/** Utilitaires de date en heure locale Europe/Paris (gestion du changement d'heure). */

export const TZ = 'Europe/Paris';
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

const partsFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export interface ParisParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Composants de date/heure murale à Paris pour un instant donné. */
export function parisParts(ms: number): ParisParts {
  const p: Record<string, number> = {};
  for (const part of partsFormat.formatToParts(new Date(ms))) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute, second: p.second };
}

/** Décalage Paris − UTC (en ms) à un instant donné. */
function offsetAt(ms: number): number {
  const p = parisParts(ms);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

/** « AAAA-MM-JJ » du jour courant à Paris. */
export function dateKeyOf(ms: number): string {
  const p = parisParts(ms);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function parseDateKey(key: string): { year: number; month: number; day: number } {
  const [year, month, day] = key.split('-').map(Number);
  return { year, month, day };
}

/** Ajoute des jours calendaires à une date « AAAA-MM-JJ » (arithmétique de calendrier, pas de 24 h). */
export function addDays(key: string, days: number): string {
  const { year, month, day } = parseDateKey(key);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Nombre de jours calendaires entre deux dates « AAAA-MM-JJ » (négatif si `to` précède `from`). */
export function daysBetween(from: string, to: string): number {
  const a = parseDateKey(from);
  const b = parseDateKey(to);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000);
}

/** Ajoute des mois à une date, en plafonnant au dernier jour du mois. */
export function addMonths(key: string, months: number): string {
  const { year, month, day } = parseDateKey(key);
  const first = new Date(Date.UTC(year, month - 1 + months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return `${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}-${pad(Math.min(day, last))}`;
}

/**
 * Instant (ms epoch) correspondant à une date « AAAA-MM-JJ » et une heure « HH:MM » murales à Paris.
 * Une heure inexistante (saut de printemps) est décalée vers l'avant ; une heure ambiguë
 * (retour d'automne) correspond à la seconde occurrence.
 */
export function parisToInstant(dateKey: string, time: string): number {
  const { year, month, day } = parseDateKey(dateKey);
  const [hour, minute] = time.split(':').map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = offsetAt(guess);
  let t = guess - first;
  const second = offsetAt(t);
  if (second !== first) t = guess - second;
  return t;
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
}

/** Décompose une durée en j / h / min (minutes arrondies à l'inférieur, minimum 0). */
export function splitDuration(ms: number): Countdown {
  const total = Math.max(0, Math.floor(ms / MINUTE));
  return { days: Math.floor(total / 1440), hours: Math.floor((total % 1440) / 60), minutes: total % 60 };
}

/** « 2 j 3 h 05 min », « 3 h 05 min », « 12 min » ; « moins d'une minute » si < 1 min. */
export function formatCountdown(ms: number): string {
  const { days, hours, minutes } = splitDuration(ms);
  if (days === 0 && hours === 0 && minutes === 0) return "moins d'une minute";
  const out: string[] = [];
  if (days > 0) out.push(`${days} j`);
  if (days > 0 || hours > 0) out.push(`${hours} h`);
  out.push(days > 0 || hours > 0 ? `${pad(minutes)} min` : `${minutes} min`);
  return out.join(' ');
}

/** Durée « 8 h », « 7 h 30 », « 45 min ». */
export function formatLength(ms: number): string {
  const total = Math.round(ms / MINUTE);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${pad(m)}`;
}

const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];
const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export const monthName = (month1: number): string => MONTHS[month1 - 1];

/** Jour de la semaine (0 = dimanche) d'une date « AAAA-MM-JJ ». */
export function weekdayIndex(key: string): number {
  const { year, month, day } = parseDateKey(key);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** « 15 novembre » */
export function formatDayMonth(key: string): string {
  const { month, day } = parseDateKey(key);
  return `${day === 1 ? '1er' : day} ${MONTHS[month - 1]}`;
}

/** « dimanche 8 novembre 2026 » */
export function formatLongDate(key: string): string {
  const { year, month, day } = parseDateKey(key);
  return `${WEEKDAYS[weekdayIndex(key)]} ${day === 1 ? '1er' : day} ${MONTHS[month - 1]} ${year}`;
}

/** « 08/11/2026 » */
export function formatNumericDate(key: string): string {
  const { year, month, day } = parseDateKey(key);
  return `${pad(day)}/${pad(month)}/${year}`;
}

/** « dim. 8 nov. » */
export function formatShortDate(key: string): string {
  const { month, day } = parseDateKey(key);
  const wd = WEEKDAYS[weekdayIndex(key)].slice(0, 3);
  return `${wd}. ${day} ${MONTHS[month - 1].slice(0, 3)}.`;
}

/** « 23/10/2026 à 13:29 » pour un instant, à l'heure de Paris. */
export function formatInstantNumeric(ms: number): { date: string; time: string } {
  const p = parisParts(ms);
  return { date: `${pad(p.day)}/${pad(p.month)}/${p.year}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
}
