/**
 * أداة تطوير: التقاط لقطات من المشهد السينمائي عبر متصفح بلا واجهة.
 * الاستخدام: node tools/shoot.mjs [t1,t2,...] [width] [height]
 */
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const times = (process.argv[2] || '0').split(',').map(Number);
const W = Number(process.argv[3] || 1440);
const H = Number(process.argv[4] || 860);
const OUT = '/tmp/shots';
fs.mkdirSync(OUT, { recursive: true });

const exe = await chromium.executablePath();
const browser = await puppeteer.launch({
  executablePath: exe,
  headless: 'shell',
  args: [
    ...chromium.args,
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--font-render-hinting=none',
  ],
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
});

const page = await browser.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2', timeout: 90000 });

await page
  .waitForFunction('window.__kbEngine && window.__kbEngine.renderer', { timeout: 90000 })
  .catch(() => errors.push('[warn] engine never appeared'));

await new Promise((r) => setTimeout(r, 2500));

for (const t of times) {
  await page.evaluate((time) => {
    const e = window.__kbEngine;
    if (!e) return;
    e.pause();
    e.time = time;
    e.update(0, false);
    e.composer.render();
    e.update(0, false);
    e.composer.render();
  }, t);
  await new Promise((r) => setTimeout(r, 900));
  const file = `${OUT}/t${String(t).replace('.', '_')}.jpg`;
  await page.screenshot({ path: file, type: 'jpeg', quality: 82 });
  console.log('shot', file);
}

if (errors.length) console.log('\n--- console ---\n' + [...new Set(errors)].slice(0, 25).join('\n'));
await browser.close();
