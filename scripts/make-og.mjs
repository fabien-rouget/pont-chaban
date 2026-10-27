// Génère l'image d'aperçu de partage (1200×630) à partir de l'illustration du pont et des styles de l'appli.
// Nécessite Playwright + Chromium : NODE_PATH=$(npm root -g) node scripts/make-og.mjs
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const html = readFileSync('index.html', 'utf8');
const css = readFileSync('src/style.css', 'utf8');
const svg = html.match(/<svg id="bridge"[\s\S]*?<\/svg>/)?.[0];
if (!svg) throw new Error('Illustration introuvable dans index.html');

const page = `<!doctype html><meta charset="utf-8"><style>${css}
*{animation:none!important;transition:none!important}
body{margin:0;width:1200px;height:630px;display:flex;align-items:center;gap:56px;padding:0 72px;box-sizing:border-box;background:var(--bg)}
.car--1{transform:translateX(60px)}.car--2{transform:translateX(250px)}.car--3{transform:translateX(120px);opacity:0}
.txt{flex:1}
.logo{width:96px;height:96px;color:var(--accent);margin-bottom:28px}
h1{font:700 84px/1 var(--serif);color:var(--accent);margin:0 0 22px;white-space:nowrap}
p{font:500 34px/1.3 var(--sans);color:var(--muted);margin:0}
.bridge{width:520px;flex:none;box-shadow:var(--shadow)}
</style>
<div class="txt">
<svg class="logo" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="currentColor"/><path d="M7 9v14M25 9v14M7 9h18M9 17h14" stroke="#f7f0e4" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>
<h1>Pont Chaban</h1><p>Pont Chaban-Delmas : état du pont et fermetures à venir</p></div>
${svg}`;

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await p.setContent(page);
writeFileSync('public/og-image.png', await p.screenshot());
await browser.close();
