import './style.css';
import { HOSTS, load, type FailReason, type Snapshot } from './lib/api';
import {
  WEEKDAY_LABELS, buildMonth, dayAriaLabel, groupByDay, monthBounds, monthKey, monthOf, shiftMonth,
  type MonthRef,
} from './lib/calendar';
import {
  computeStatus, prettyLabel, toClosures, typeLabel, upcomingClosures, type Closure, type Status,
} from './lib/closures';
import {
  MINUTE, addDays, dateKeyOf, formatCountdown, formatDayMonth, formatInstantNumeric, formatLength,
  formatLongDate, formatNumericDate, formatShortDate, parseDateKey,
} from './lib/time';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

/* ---------- État ---------- */
interface AppState {
  snapshot: Snapshot | null;
  offline: boolean;
  all: Closure[];
  failed: boolean;
  reason: FailReason;
  selectedDay: string | null;
  viewMonth: MonthRef | null;
  focusDay: string | null;
}
const state: AppState = {
  snapshot: null, offline: false, all: [], failed: false, reason: 'source', selectedDay: null, viewMonth: null, focusDay: null,
};
let lastDayKey = '';
let loading = false;
let retryTimer: number | undefined;

function scheduleRetry(ms: number): void {
  clearTimeout(retryTimer);
  retryTimer = window.setTimeout(() => void refresh(), ms);
}

/* ---------- Petit utilitaire DOM ---------- */
type Child = Node | string | null | undefined | false;
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Record<string, string | boolean | undefined> = {}, ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children) if (c) node.append(c);
  return node;
}

/* ---------- Thème ---------- */
function initTheme(): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const isDark = () => document.documentElement.dataset.theme === 'dark';
  const apply = () => meta?.setAttribute('content', isDark() ? '#1b1214' : '#6b1e2e');
  apply();
  $('theme').addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('pont-chaban:theme', next); } catch { /* sans stockage */ }
    apply();
  });
}

/* ---------- Bloc principal ---------- */
function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

function renderHero(now: number): void {
  const title = $('status-title');
  const pill = $('pill');
  const bridge = $('bridge');
  const box = $('countdown');

  if (state.failed) {
    const source = state.reason !== 'network';
    setText(title, source ? 'Données officielles indisponibles.' : 'Connexion impossible.');
    title.className = 'hero__title';
    pill.className = 'pill pill--loading';
    setText($('pill-text'), 'Inconnu');
    box.replaceChildren(
      el('p', { class: 'countdown__label' }, source
        ? (state.reason === 'timeout'
          ? "Le service de données officiel de Bordeaux Métropole ne répond pas (délai de 10 secondes dépassé) : il est probablement en panne ou surchargé. Les prévisions de fermeture ne peuvent pas être récupérées. Nouvel essai automatique toutes les minutes."
          : "Le service de données officiel de Bordeaux Métropole est actuellement en panne : les prévisions de fermeture ne peuvent pas être récupérées. Ce n'est pas un problème de votre appareil. Nouvel essai automatique toutes les minutes.")
        : "Impossible de joindre le service de données de Bordeaux Métropole. Vérifiez votre connexion internet. Nouvel essai automatique toutes les minutes."),
      el('button', { class: 'retry', type: 'button', id: 'retry' }, 'Réessayer'),
    );
    return;
  }
  if (!state.snapshot) return;

  const status: Status = computeStatus(state.all, now);
  const closed = status.state === 'closed';
  setText(title, closed ? 'Pont fermé à la circulation' : 'Pont ouvert à la circulation');
  title.className = `hero__title ${closed ? 'is-closed' : 'is-open'}`;
  pill.className = `pill ${closed ? 'pill--closed' : 'pill--open'}`;
  setText($('pill-text'), closed ? 'Fermé' : 'Ouvert');
  bridge.classList.toggle('is-closed', closed);

  const target = closed ? status.current : status.next;
  if (!target) {
    box.replaceChildren(
      el('p', { class: 'countdown__label' }, 'Prochaine fermeture'),
      el('p', { class: 'countdown__value' }, 'Aucune fermeture prévue'),
      el('p', { class: 'countdown__next' }, 'Aucune fermeture n’est annoncée pour le moment dans les prévisions officielles.'),
    );
    return;
  }

  const label = closed ? 'Réouverture dans' : 'Prochaine fermeture dans';
  const remaining = closed ? (status.reopensAt ?? target.end) - now : target.start - now;
  const progress = closed ? Math.min(1, Math.max(0, (now - target.start) / (target.end - target.start))) : 0;
  const barAttrs = closed ? { class: 'frise__bar' } : { class: 'frise__bar frise__bar--idle' };
  const fill = el('span', { class: 'frise__fill' });
  fill.style.width = `${Math.round(progress * 100)}%`;
  const bar = el('div', barAttrs, closed ? fill : null);

  const frise = el('div', { class: 'frise' },
    el('div', { class: 'frise__end' }, el('span', {}, `Fermeture · ${formatShortDate(target.dateKey)}`), el('strong', {}, target.startTime)),
    bar,
    el('div', { class: 'frise__end frise__end--right' },
      el('span', {}, `Réouverture${target.overnight ? ' · lendemain' : ` · ${formatShortDate(target.endDateKey)}`}`),
      el('strong', {}, target.endTime)),
  );
  const meta = el('p', { class: 'countdown__meta' },
    el('span', { class: 'countdown__event' }, prettyLabel(target.label)),
    el('span', {}, `Durée prévue : ${formatLength(target.end - target.start)}`),
  );
  const parts: Child[] = [
    el('p', { class: 'countdown__label' }, label),
    el('p', { class: 'countdown__value' }, formatCountdown(remaining)),
    frise, meta,
  ];
  if (closed && status.next) {
    parts.push(el('p', { class: 'countdown__next' },
      `Puis : ${prettyLabel(status.next.label)}, le ${formatShortDate(status.next.dateKey)} de ${status.next.startTime} à ${status.next.endTime}.`));
  }
  box.replaceChildren(...parts.filter((p): p is Node | string => !!p));
}

function renderFreshness(now: number): void {
  const line = $('freshness');
  const stale = $('stale');
  const banner = $('offline');
  const snap = state.snapshot;
  if (!snap) { line.textContent = ''; stale.replaceChildren(); banner.hidden = true; return; }

  banner.hidden = !state.offline;
  if (state.offline) {
    const f = formatInstantNumeric(snap.fetchedAt);
    banner.textContent = state.reason !== 'network'
      ? `Hors ligne – données du ${f.date} à ${f.time}. Le service officiel de Bordeaux Métropole est en panne ou ne répond pas, ces prévisions peuvent ne plus être à jour.`
      : `Hors ligne – données du ${f.date} à ${f.time}`;
  }
  const via = snap.host && snap.host !== HOSTS[0] ? ` (via ${new URL(snap.host).hostname})` : '';
  const processed = snap.processedAt ? Date.parse(snap.processedAt) : NaN;
  if (!Number.isNaN(processed)) {
    const f = formatInstantNumeric(processed);
    line.textContent = `Données mises à jour par Bordeaux Métropole le ${f.date} à ${f.time}${via}`;
    stale.replaceChildren(...(now - processed > 8 * 24 * 60 * MINUTE
      ? [el('div', { class: 'fresh__warn', role: 'alert' },
          'Attention : ces données ont plus de 8 jours. Les prévisions affichées peuvent ne plus être à jour.')]
      : []));
  } else {
    const f = formatInstantNumeric(snap.fetchedAt);
    line.textContent = `Date de mise à jour de la source inconnue · données récupérées le ${f.date} à ${f.time}${via}`;
    stale.replaceChildren();
  }
}

/* ---------- Fermetures à venir ---------- */
function visibleClosures(now: number): Closure[] {
  return upcomingClosures(state.all, now);
}

function renderCalendar(now: number): void {
  const root = $('calendar');
  if (!state.snapshot) { root.replaceChildren(); return; }
  const list = visibleClosures(now);
  const bounds = monthBounds(list, now);
  if (!state.viewMonth || monthKey(state.viewMonth) < monthKey(bounds.min)) state.viewMonth = bounds.min;
  if (monthKey(state.viewMonth) > monthKey(bounds.max)) state.viewMonth = bounds.max;
  const view = state.viewMonth;
  const month = buildMonth(view.year, view.month, list, now);

  const prev = el('button', { class: 'nav-btn', type: 'button', 'aria-label': 'Mois précédent' }, el('span', { 'aria-hidden': 'true' }, '‹'));
  const next = el('button', { class: 'nav-btn', type: 'button', 'aria-label': 'Mois suivant' }, el('span', { 'aria-hidden': 'true' }, '›'));
  prev.disabled = monthKey(view) <= monthKey(bounds.min);
  next.disabled = monthKey(view) >= monthKey(bounds.max);
  prev.addEventListener('click', () => goToMonth(shiftMonth(view, -1)));
  next.addEventListener('click', () => goToMonth(shiftMonth(view, 1)));

  const grid = el('div', { class: 'cal-grid', role: 'group', 'aria-labelledby': 'cal-title' });
  for (const w of WEEKDAY_LABELS) grid.append(el('div', { class: 'cal-dow', 'aria-hidden': 'true' }, w));

  const inView = month.weeks.flat().filter((c) => c !== null);
  const focusKey = state.focusDay && inView.some((c) => c.dateKey === state.focusDay)
    ? state.focusDay
    : (inView.find((c) => c.isToday) ?? inView.find((c) => c.closures.length) ?? inView[0]).dateKey;

  for (const week of month.weeks) {
    for (const cell of week) {
      if (!cell) { grid.append(el('div', { class: 'day day--empty', 'aria-hidden': 'true' })); continue; }
      const n = cell.closures.length;
      const classes = ['day', n ? 'day--marked' : '', cell.isPast ? 'day--past' : '', cell.isToday ? 'day--today' : '']
        .filter(Boolean).join(' ');
      const btn = el('button', {
        class: classes, type: 'button', 'data-date': cell.dateKey,
        'aria-label': dayAriaLabel(formatDayMonth(cell.dateKey), n),
        'aria-pressed': n ? String(state.selectedDay === cell.dateKey) : undefined,
        'aria-current': cell.isToday ? 'date' : undefined,
        'aria-disabled': n ? undefined : 'true',
        tabindex: cell.dateKey === focusKey ? '0' : '-1',
      }, el('span', {}, String(cell.day)), el('span', { class: 'day__dot', 'aria-hidden': 'true' }));
      grid.append(btn);
    }
  }
  grid.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button.day[data-date]');
    if (btn) selectDay(btn.dataset.date!);
  });
  grid.addEventListener('keydown', (e) => onGridKey(e as KeyboardEvent, bounds));

  const title = el('h3', { class: 'calendar__title', id: 'cal-title', 'aria-live': 'polite' }, month.title);
  root.replaceChildren(
    el('div', { class: 'calendar__head' }, prev, title, next),
    grid,
    el('p', { class: 'cal-legend' }, '● jour avec au moins une fermeture. Une fermeture de nuit est marquée à sa date de passage.'),
  );
  if (state.focusDay) {
    root.querySelector<HTMLButtonElement>(`[data-date="${state.focusDay}"]`)?.focus();
    state.focusDay = null;
  }
}

function goToMonth(m: MonthRef): void {
  state.viewMonth = m;
  renderCalendar(Date.now());
  renderDetail(Date.now());
}

function selectDay(key: string): void {
  const has = visibleClosures(Date.now()).some((c) => c.dateKey === key);
  if (!has) return;
  state.selectedDay = state.selectedDay === key ? null : key;
  state.focusDay = key;
  renderCalendar(Date.now());
  renderDetail(Date.now());
}

function onGridKey(e: KeyboardEvent, bounds: { min: MonthRef; max: MonthRef }): void {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button.day[data-date]');
  if (!btn) return;
  const key = btn.dataset.date!;
  let target: string | null = null;
  switch (e.key) {
    case 'ArrowLeft': target = addDays(key, -1); break;
    case 'ArrowRight': target = addDays(key, 1); break;
    case 'ArrowUp': target = addDays(key, -7); break;
    case 'ArrowDown': target = addDays(key, 7); break;
    case 'Home': target = addDays(key, -((new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7)); break;
    case 'End': target = addDays(key, 6 - ((new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7)); break;
    case 'PageUp': target = shiftMonthKey(key, -1); break;
    case 'PageDown': target = shiftMonthKey(key, 1); break;
    default: return;
  }
  e.preventDefault();
  const m = monthOf(target);
  if (monthKey(m) < monthKey(bounds.min) || monthKey(m) > monthKey(bounds.max)) return;
  state.focusDay = target;
  state.viewMonth = m;
  renderCalendar(Date.now());
}

function shiftMonthKey(key: string, delta: number): string {
  const { year, month, day } = parseDateKey(key);
  const m = shiftMonth({ year, month }, delta);
  const last = new Date(Date.UTC(m.year, m.month, 0)).getUTCDate();
  return `${m.year}-${String(m.month).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
}

function renderDetail(now: number): void {
  const box = $('detail');
  if (!state.snapshot) { box.replaceChildren(); return; }
  const key = state.selectedDay;
  const items = key ? (groupByDay(visibleClosures(now)).get(key) ?? []) : [];
  if (!key || items.length === 0) {
    box.replaceChildren(el('p', { class: 'detail__hint' }, 'Sélectionnez un jour marqué d’un point pour voir le détail de la fermeture.'));
    return;
  }
  const ul = el('ul');
  for (const c of items) {
    const when = c.overnight
      ? `de ${c.startTime} jusqu'à ${c.endTime} le lendemain`
      : `de ${c.startTime} à ${c.endTime}`;
    ul.append(el('li', {},
      el('strong', {}, prettyLabel(c.label)),
      ` : ${when} (${formatLength(c.end - c.start)}). Fermeture ${c.type ? c.type.toLowerCase() : 'non précisée'}.`));
  }
  box.replaceChildren(el('h3', {}, formatLongDate(key)), ul);
}

function renderList(now: number): void {
  const root = $('list');
  if (!state.snapshot) { root.replaceChildren(); return; }
  const list = visibleClosures(now);
  if (list.length === 0) {
    root.replaceChildren(el('p', { class: 'empty' }, 'Aucune fermeture à venir dans les prévisions officielles.'));
    return;
  }
  const head = el('tr', {},
    ...['Événement', 'Date de passage', 'Fermeture à la circulation', 'Réouverture à la circulation', 'Type de fermeture']
      .map((h) => el('th', { scope: 'col' }, h)));
  const body = el('tbody');
  for (const c of list) {
    const tr = el('tr', {
      'data-date': c.dateKey,
      class: c.end <= now ? 'is-done' : undefined,
    },
      el('td', { class: 'ev' }, prettyLabel(c.label)),
      el('td', { 'data-label': 'Date de passage' }, formatNumericDate(c.dateKey)),
      el('td', { 'data-label': 'Fermeture' }, c.startTime),
      el('td', { 'data-label': 'Réouverture' }, el('span', {}, c.endTime, c.overnight ? el('span', { class: 'next-day' }, ' (lendemain)') : null)),
      el('td', { 'data-label': 'Type' }, el('span', { class: 'tag' }, typeLabel(c.type))),
    );
    body.append(tr);
  }
  const table = el('table', { class: 'tbl' }, el('caption', { class: 'list-title' }, `Liste complète (${list.length})`), el('thead', {}, head), body);
  root.replaceChildren(table);
}

/* ---------- Cycle de vie ---------- */
function renderAll(): void {
  const now = Date.now();
  lastDayKey = dateKeyOf(now);
  renderHero(now);
  renderFreshness(now);
  renderCalendar(now);
  renderDetail(now);
  renderList(now);
}

function tick(): void {
  const now = Date.now();
  if (dateKeyOf(now) !== lastDayKey) renderAll();
  else { renderHero(now); renderFreshness(now); }
}

function scheduleTick(): void {
  const delay = MINUTE - (Date.now() % MINUTE) + 50;
  setTimeout(() => { tick(); scheduleTick(); }, delay);
}

async function refresh(): Promise<void> {
  if (loading) return;
  loading = true;
  const result = await load();
  loading = false;
  state.reason = result.reason ?? 'source';
  if (!result.snapshot) {
    if (!state.snapshot) {
      state.failed = true;
      renderHero(Date.now());
      scheduleRetry(MINUTE);
    }
    return;
  }
  state.failed = false;
  state.snapshot = result.snapshot;
  state.offline = result.offline;
  state.all = toClosures(result.snapshot.records);
  renderAll();
  if (result.offline) scheduleRetry(5 * MINUTE);
  else clearTimeout(retryTimer);
}

function initTabs(): void {
  const tabs = [$('tab-list'), $('tab-cal')];
  const panels = [$('panel-list'), $('panel-cal')];
  const show = (i: number, focus = false) => {
    tabs.forEach((t, j) => {
      t.setAttribute('aria-selected', String(i === j));
      t.tabIndex = i === j ? 0 : -1;
      panels[j].hidden = i !== j;
    });
    if (focus) tabs[i].focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => show(i));
    t.addEventListener('keydown', (e) => {
      const k = (e as KeyboardEvent).key;
      if (k === 'ArrowRight' || k === 'ArrowLeft') { e.preventDefault(); show((i + 1) % tabs.length, true); }
      else if (k === 'Home') { e.preventDefault(); show(0, true); }
      else if (k === 'End') { e.preventDefault(); show(tabs.length - 1, true); }
    });
  });
}

function init(): void {
  initTheme();
  initTabs();
  $('countdown').addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id === 'retry') { state.failed = false; setText($('status-title'), 'Chargement…'); void refresh(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const age = state.snapshot ? Date.now() - state.snapshot.fetchedAt : Infinity;
    if (age > 30 * MINUTE || state.offline) void refresh(); else tick();
  });
  addEventListener('online', () => void refresh());
  void refresh();
  scheduleTick();
}

init();
