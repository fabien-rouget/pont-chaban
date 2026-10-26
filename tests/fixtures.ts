import type { RawRecord } from '../src/lib/closures';

const rec = (bateau: string, date: string, from: string, to: string): RawRecord => ({
  bateau,
  date_passage: date,
  fermeture_a_la_circulation: from,
  re_ouverture_a_la_circulation: to,
  type_de_fermeture: 'Totale',
  fermeture_totale: 'oui',
});

/** Échantillon conforme au schéma du jeu « previsions_pont_chaban » (valeurs fictives). */
export const sample: RawRecord[] = [
  rec('MAINTENANCE', '2026-10-24', '23:00', '05:00'),
  rec('MARATHON DE BORDEAUX', '2026-11-08', '07:00', '15:00'),
  rec('NAVIRE EXEMPLE', '2026-11-15', '23:00', '05:00'),
  rec('MAINTENANCE', '2026-11-15', '10:00', '12:00'),
  rec('AUTRE NAVIRE', '2027-01-12', '03:30', '06:00'),
];
