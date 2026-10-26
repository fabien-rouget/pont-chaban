import { describe, expect, it } from 'vitest';
import {
  buildMonth, dayAriaLabel, monthBounds, mondayIndex, shiftMonth,
} from '../src/lib/calendar';
import { toClosures, upcomingClosures } from '../src/lib/closures';
import { parisToInstant } from '../src/lib/time';
import { sample } from './fixtures';

const now = parisToInstant('2026-11-10', '09:00');
const list = upcomingClosures(toClosures(sample), now);

describe('grille mensuelle', () => {
  it('commence le lundi : 1er novembre 2026 est un dimanche → 6 cases vides', () => {
    expect(mondayIndex('2026-11-01')).toBe(6);
    const m = buildMonth(2026, 11, list, now);
    expect(m.weeks[0].slice(0, 6).every((c) => c === null)).toBe(true);
    expect(m.weeks[0][6]?.day).toBe(1);
    expect(m.weeks.every((w) => w.length === 7)).toBe(true);
  });
  it('un mois commençant un lundi n\'a aucun remplissage initial', () => {
    expect(buildMonth(2026, 6, [], now).weeks[0][0]?.day).toBe(1);
  });
  it('marque les jours avec fermeture, jour courant et jours passés', () => {
    const m = buildMonth(2026, 11, list, now);
    const cells = m.weeks.flat().filter((c) => c !== null);
    const marked = cells.filter((c) => c!.closures.length > 0).map((c) => c!.dateKey);
    expect(marked).toEqual(['2026-11-15']);
    expect(cells.find((c) => c!.isToday)!.dateKey).toBe('2026-11-10');
    expect(cells.find((c) => c!.dateKey === '2026-11-09')!.isPast).toBe(true);
    expect(cells.find((c) => c!.dateKey === '2026-11-15')!.closures).toHaveLength(2);
  });
  it('nuit marquée sur sa date_passage, pas sur le lendemain', () => {
    const cells = buildMonth(2026, 11, list, now).weeks.flat().filter((c) => c !== null);
    expect(cells.find((c) => c!.dateKey === '2026-11-16')!.closures).toHaveLength(0);
  });
  it('mois sans fermeture', () => {
    const cells = buildMonth(2026, 12, list, now).weeks.flat().filter((c) => c !== null);
    expect(cells.some((c) => c!.closures.length > 0)).toBe(false);
    expect(cells).toHaveLength(31);
  });
  it('titre en français', () => {
    expect(buildMonth(2026, 11, [], now).title).toBe('Novembre 2026');
    expect(buildMonth(2027, 2, [], now).weeks.flat().filter(Boolean)).toHaveLength(28);
  });
});

describe('navigation et libellés', () => {
  it('bornes : mois courant → dernier mois avec données', () => {
    expect(monthBounds(list, now)).toEqual({ min: { year: 2026, month: 11 }, max: { year: 2027, month: 1 } });
  });
  it('bornes sans donnée : mois courant uniquement', () => {
    expect(monthBounds([], now)).toEqual({ min: { year: 2026, month: 11 }, max: { year: 2026, month: 11 } });
  });
  it('shiftMonth passe le cap de l\'année', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2027, month: 1 }, -1)).toEqual({ year: 2026, month: 12 });
  });
  it('libellé accessible', () => {
    expect(dayAriaLabel('15 novembre', 1)).toBe('15 novembre : 1 fermeture');
    expect(dayAriaLabel('15 novembre', 2)).toBe('15 novembre : 2 fermetures');
    expect(dayAriaLabel('16 novembre', 0)).toBe('16 novembre');
  });
});
