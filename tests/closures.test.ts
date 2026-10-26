import { describe, expect, it } from 'vitest';
import { computeStatus, prettyLabel, toClosure, toClosures, typeLabel, upcomingClosures } from '../src/lib/closures';
import { HOUR, parisToInstant } from '../src/lib/time';
import { sample } from './fixtures';

const at = (d: string, t: string) => parisToInstant(d, t);

describe('toClosure', () => {
  it('fermeture de jour', () => {
    const c = toClosure(sample[1])!;
    expect(c.overnight).toBe(false);
    expect(c.endDateKey).toBe('2026-11-08');
    expect(c.end - c.start).toBe(8 * HOUR);
  });
  it('nuit à cheval sur minuit : réouverture le lendemain, marquée sur date_passage', () => {
    const c = toClosure(sample[2])!;
    expect(c.overnight).toBe(true);
    expect(c.dateKey).toBe('2026-11-15');
    expect(c.endDateKey).toBe('2026-11-16');
    expect(c.end - c.start).toBe(6 * HOUR);
  });
  it('nuit du changement d\'heure de printemps : 5 h réelles', () => {
    const c = toClosure({ ...sample[2], date_passage: '2026-03-28' })!;
    expect(c.end - c.start).toBe(5 * HOUR);
  });
  it('nuit du changement d\'heure d\'automne : 7 h réelles', () => {
    const c = toClosure({ ...sample[2], date_passage: '2026-10-24' })!;
    expect(c.end - c.start).toBe(7 * HOUR);
  });
  it('enregistrement invalide ignoré', () => {
    expect(toClosure({ date_passage: null })).toBeNull();
    expect(toClosures([{ bateau: 'X' }, sample[1]])).toHaveLength(1);
  });
  it('type inconnu affiché tel quel', () => {
    expect(typeLabel('partielle')).toBe('Partielle');
    expect(typeLabel('')).toBe('Non précisé');
  });
});

describe('statut', () => {
  const all = toClosures(sample);

  it('ouvert avant la prochaine fermeture', () => {
    const s = computeStatus(all, at('2026-11-01', '12:00'));
    expect(s.state).toBe('open');
    expect(s.next?.dateKey).toBe('2026-11-08');
  });
  it('fermeture en cours', () => {
    const s = computeStatus(all, at('2026-11-08', '09:00'));
    expect(s.state).toBe('closed');
    expect(s.reopensAt).toBe(at('2026-11-08', '15:00'));
    expect(s.next?.dateKey).toBe('2026-11-15');
  });
  it('fermeture de nuit en cours après minuit (date_passage la veille)', () => {
    const s = computeStatus(all, at('2026-11-16', '02:00'));
    expect(s.state).toBe('closed');
    expect(s.current?.dateKey).toBe('2026-11-15');
  });
  it('bornes : fermé à l\'heure de fermeture, rouvert à l\'heure de réouverture', () => {
    expect(computeStatus(all, at('2026-11-08', '07:00')).state).toBe('closed');
    expect(computeStatus(all, at('2026-11-08', '15:00')).state).toBe('open');
  });
  it('fermetures contiguës fusionnées', () => {
    const c = toClosures([
      { ...sample[1], fermeture_a_la_circulation: '07:00', re_ouverture_a_la_circulation: '10:00' },
      { ...sample[1], fermeture_a_la_circulation: '10:00', re_ouverture_a_la_circulation: '12:00' },
    ]);
    expect(computeStatus(c, at('2026-11-08', '08:00')).reopensAt).toBe(at('2026-11-08', '12:00'));
  });
  it('aucune fermeture à venir', () => {
    const s = computeStatus(all, at('2027-06-01', '12:00'));
    expect(s).toMatchObject({ state: 'open', next: null, current: null });
  });
});

describe('fermetures à venir', () => {
  const all = toClosures(sample);
  it('exclut le passé, garde la nuit encore en cours', () => {
    const list = upcomingClosures(all, at('2026-10-25', '03:00'));
    expect(list[0].dateKey).toBe('2026-10-24'); // nuit 24→25 encore en cours
    expect(upcomingClosures(all, at('2026-10-26', '12:00'))[0].dateKey).toBe('2026-11-08');
  });
  it('garde les fermetures déjà terminées aujourd\'hui', () => {
    const list = upcomingClosures(all, at('2026-11-08', '18:00'));
    expect(list[0].dateKey).toBe('2026-11-08');
  });
});

describe('prettyLabel', () => {
  it('met en forme les libellés en majuscules', () => {
    expect(prettyLabel('MARATHON DE BORDEAUX')).toBe('Marathon de Bordeaux');
    expect(prettyLabel('MAINTENANCE')).toBe('Maintenance');
    expect(prettyLabel('Déjà Formaté')).toBe('Déjà Formaté');
    expect(prettyLabel('')).toBe('Fermeture programmée');
  });
});
