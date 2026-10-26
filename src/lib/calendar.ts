import type { Closure } from './closures';
import { addDays, addMonths, dateKeyOf, monthName, pad, parseDateKey, weekdayIndex } from './time';

export interface DayCell {
  dateKey: string;
  day: number;
  closures: Closure[];
  isToday: boolean;
  isPast: boolean;
}

export interface MonthView {
  year: number;
  month: number; // 1-12
  title: string; // « Novembre 2026 »
  /** Semaines lundi → dimanche ; null = case de remplissage. */
  weeks: (DayCell | null)[][];
}

export const WEEKDAY_LABELS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];

/** Index lundi=0 … dimanche=6. */
export function mondayIndex(key: string): number {
  return (weekdayIndex(key) + 6) % 7;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function groupByDay(closures: Closure[]): Map<string, Closure[]> {
  const map = new Map<string, Closure[]>();
  for (const c of closures) {
    const list = map.get(c.dateKey);
    if (list) list.push(c);
    else map.set(c.dateKey, [c]);
  }
  return map;
}

export function buildMonth(year: number, month: number, closures: Closure[], now: number): MonthView {
  const byDay = groupByDay(closures);
  const today = dateKeyOf(now);
  const total = daysInMonth(year, month);
  const lead = mondayIndex(`${year}-${pad(month)}-01`);
  const cells: (DayCell | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= total; day++) {
    const dateKey = `${year}-${pad(month)}-${pad(day)}`;
    cells.push({
      dateKey,
      day,
      closures: byDay.get(dateKey) ?? [],
      isToday: dateKey === today,
      isPast: dateKey < today,
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (DayCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { year, month, title: `${monthName(month)} ${year}`.replace(/^./, (c) => c.toUpperCase()), weeks };
}

export interface MonthRef {
  year: number;
  month: number;
}

export const monthKey = (m: MonthRef): number => m.year * 12 + (m.month - 1);

export function monthOf(dateKey: string): MonthRef {
  const { year, month } = parseDateKey(dateKey);
  return { year, month };
}

export function shiftMonth(m: MonthRef, delta: number): MonthRef {
  const idx = monthKey(m) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

/** Bornes de navigation : du mois courant au dernier mois contenant des fermetures. */
export function monthBounds(closures: Closure[], now: number): { min: MonthRef; max: MonthRef } {
  const min = monthOf(dateKeyOf(now));
  let max = min;
  for (const c of closures) {
    const m = monthOf(c.dateKey);
    if (monthKey(m) > monthKey(max)) max = m;
  }
  return { min, max };
}

/** Libellé accessible d'un jour : « 15 novembre : 1 fermeture ». */
export function dayAriaLabel(label: string, count: number): string {
  if (count === 0) return label;
  return `${label} : ${count} fermeture${count > 1 ? 's' : ''}`;
}

export interface Summary {
  from: string;
  to: string;
  count: number;
}

/** Résumé sur les trois prochains mois à partir d'aujourd'hui. */
export function threeMonthSummary(closures: Closure[], now: number): Summary {
  const from = dateKeyOf(now);
  const to = addDays(addMonths(from, 3), -1);
  const count = closures.filter((c) => c.dateKey >= from && c.dateKey <= to).length;
  return { from, to, count };
}
