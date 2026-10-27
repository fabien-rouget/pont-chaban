// Génère les icônes PNG de la PWA à partir d'un SVG (nécessite Playwright + Chromium) :
//   NODE_PATH=$(npm root -g) node scripts/make-icons.mjs
// Dessin : deux pylônes, tablier relevé, haubans, voilier dessous, vague.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const CREAM = '#f7f0e4';
const WINE = '#6b1e2e';

/** Détails du dessin ; `boat` et `waves` sont retirés pour le favicon (trop petit pour les lire). */
const glyph = ({ boat = true, waves = true } = {}) => `
  <g fill="${CREAM}">
    <rect x="120" y="120" width="48" height="280" rx="6"/><rect x="344" y="120" width="48" height="280" rx="6"/>
    <rect x="120" y="120" width="272" height="30" rx="6"/>
    <rect x="48" y="338" width="80" height="24" rx="4"/><rect x="384" y="338" width="80" height="24" rx="4"/>
    <path d="M144 132L58 338M144 132L100 338M368 132L412 338M368 132L454 338" stroke="${CREAM}" stroke-width="7" fill="none"/>
    <rect x="168" y="196" width="176" height="24" rx="4"/><rect x="156" y="186" width="16" height="44" rx="4"/><rect x="340" y="186" width="16" height="44" rx="4"/>
    ${boat ? '<path d="M206 392h100l-18 26h-64z"/><path d="M256 384V282l44 94z"/><path d="M248 384V312l-38 72z" opacity=".75"/>' : ''}
  </g>
  ${waves ? `<path d="M64 434q24-18 48 0t48 0 48 0 48 0 48 0 48 0" stroke="${CREAM}" stroke-width="12" stroke-linecap="round" fill="none" opacity=".65"/>` : ''}`;

/** Icône complète ; `scale` < 1 réserve une marge (zone de sécurité des icônes « maskable »). */
const icon = ({ rounded, scale, ...opts }) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ''} fill="${WINE}"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -278)">${glyph(opts)}</g>
</svg>`;

const jobs = [
  ['public/icon-512.png', 512, icon({ rounded: true, scale: 1 })],
  ['public/icon-192.png', 192, icon({ rounded: true, scale: 1 })],
  ['public/icon-maskable-512.png', 512, icon({ rounded: false, scale: 0.74 })],
  ['public/apple-touch-icon.png', 180, icon({ rounded: false, scale: 0.92 })],
];

writeFileSync('public/favicon.svg', icon({ rounded: true, scale: 1, boat: false, waves: false }).replace(' width="512" height="512"', '') + '\n');

const browser = await chromium.launch();
for (const [file, size, markup] of jobs) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${markup}`);
  writeFileSync(file, await page.screenshot({ omitBackground: true }));
  await page.close();
}
await browser.close();
