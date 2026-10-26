import { afterEach, describe, expect, it, vi } from 'vitest';
import { load, recordsUrl } from '../src/lib/api';
import { sample } from './fixtures';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

afterEach(() => vi.unstubAllGlobals());

describe('load', () => {
  it('succès : enregistrements + fraîcheur', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url.includes('/records')
        ? json({ total_count: sample.length, results: sample })
        : json({ metas: { default: { data_processed: '2026-10-23T13:29:55+00:00' } } })));
    const r = await load(Date.parse('2026-10-26T10:00:00Z'));
    expect(r.offline).toBe(false);
    expect(r.snapshot?.records).toHaveLength(sample.length);
    expect(r.snapshot?.processedAt).toBe('2026-10-23T13:29:55+00:00');
  });

  it('erreur HTTP 502 : panne de la source', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Bad Gateway', { status: 502 })));
    const r = await load();
    expect(r).toMatchObject({ snapshot: null, offline: true, reason: 'source' });
  });

  it('délai dépassé : timeout', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('timeout', 'TimeoutError'); }));
    expect((await load()).reason).toBe('timeout');
  });

  it('pas de connexion : network', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    expect((await load()).reason).toBe('network');
  });

  it('requête filtrée à partir d\'hier, triée, paginée', () => {
    const u = new URL(recordsUrl('2026-10-25', 100));
    expect(u.searchParams.get('where')).toBe("date_passage>=date'2026-10-25'");
    expect(u.searchParams.get('order_by')).toBe('date_passage,fermeture_a_la_circulation');
    expect(u.searchParams.get('offset')).toBe('100');
  });
});
