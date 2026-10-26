// Génère les icônes PNG de la PWA à partir d'un SVG (nécessite Playwright + Chromium).
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { writeFileSync } from 'node:fs';

// Pont stylisé : deux pylônes, tablier relevé, sur fond bordeaux.
const glyph = `
  <g stroke="#f7f0e4" stroke-linecap="round" stroke-linejoin="round" fill="none" stroke-width="22">
    <path d="M150 140v232M362 140v232M150 140h212"/>
    <path d="M150 250h212" stroke-width="26"/>
  </g>
  <path d="M96 400h320" stroke="#f7f0e4" stroke-width="16" stroke-linecap="round" opacity=".55"/>`;

const svg = (rounded, scale) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ''} fill="#6b1e2e"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${glyph}</g>
</svg>`;

const jobs = [
  ['public/icon-512.png', 512, svg(true, 1)],
  ['public/icon-192.png', 192, svg(true, 1)],
  ['public/icon-maskable-512.png', 512, svg(false, 0.72)],
  ['public/apple-touch-icon.png', 180, svg(false, 0.9)],
];

const browser = await chromium.launch();
for (const [file, size, markup] of jobs) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${markup}`);
  writeFileSync(file, await page.screenshot({ omitBackground: true }));
  await page.close();
}
await browser.close();
