import { describe, expect, it } from 'vitest';
import {
  addDays, addMonths, dateKeyOf, formatCountdown, formatLength, parisToInstant, splitDuration, HOUR,
} from '../src/lib/time';

describe('parisToInstant', () => {
  it('hiver : UTC+1', () => {
    expect(new Date(parisToInstant('2026-12-10', '12:00')).toISOString()).toBe('2026-12-10T11:00:00.000Z');
  });
  it('été : UTC+2', () => {
    expect(new Date(parisToInstant('2026-07-10', '12:00')).toISOString()).toBe('2026-07-10T10:00:00.000Z');
  });
  it('heure inexistante du printemps décalée vers l\'avant', () => {
    expect(new Date(parisToInstant('2026-03-29', '02:30')).toISOString()).toBe('2026-03-29T01:30:00.000Z');
  });
  it('heure ambiguë d\'automne : seconde occurrence', () => {
    expect(new Date(parisToInstant('2026-10-25', '02:30')).toISOString()).toBe('2026-10-25T01:30:00.000Z');
  });
});

describe('calendrier', () => {
  it('addDays traverse minuit et fin de mois/année', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('addMonths plafonne au dernier jour', () => {
    expect(addMonths('2026-11-30', 3)).toBe('2027-02-28');
    expect(addMonths('2026-10-26', 3)).toBe('2027-01-26');
  });
  it('dateKeyOf utilise la date de Paris, pas UTC', () => {
    expect(dateKeyOf(Date.parse('2026-12-10T23:30:00Z'))).toBe('2026-12-11');
  });
  it('journée de changement d\'heure ≠ 24 h', () => {
    const spring = parisToInstant('2026-03-30', '00:00') - parisToInstant('2026-03-29', '00:00');
    const autumn = parisToInstant('2026-10-26', '00:00') - parisToInstant('2026-10-25', '00:00');
    expect(spring).toBe(23 * HOUR);
    expect(autumn).toBe(25 * HOUR);
  });
});

describe('formats', () => {
  it('formatCountdown', () => {
    expect(formatCountdown(((2 * 24 + 3) * 60 + 5) * 60_000)).toBe('2 j 3 h 05 min');
    expect(formatCountdown(3 * HOUR + 5 * 60_000)).toBe('3 h 05 min');
    expect(formatCountdown(12 * 60_000)).toBe('12 min');
    expect(formatCountdown(20_000)).toBe("moins d'une minute");
  });
  it('splitDuration', () => {
    expect(splitDuration(-5)).toEqual({ days: 0, hours: 0, minutes: 0 });
  });
  it('formatLength', () => {
    expect(formatLength(8 * HOUR)).toBe('8 h');
    expect(formatLength(2.5 * HOUR)).toBe('2 h 30');
    expect(formatLength(45 * 60_000)).toBe('45 min');
  });
});
