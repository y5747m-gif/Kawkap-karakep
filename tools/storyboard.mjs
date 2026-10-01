/**
 * أداة تطوير: تصدير لوحة القصة (storyboard) من المشهد السينمائي نفسه،
 * بدون أي عناصر واجهة — كادرات نظيفة بدقة عالية.
 * الاستخدام: node tools/storyboard.mjs
 */
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('public/storyboard');
fs.mkdirSync(OUT, { recursive: true });

const FRAMES = [
  { t: 1.6, file: '01-macro.jpg', title: 'انزلاق ماكرو فوق المفاتيح الوردية' },
  { t: 6.4, file: '02-focus.jpg', title: 'التركيز على المفتاح البطل' },
  { t: 11.2, file: '03-explode.jpg', title: 'بداية التفكيك الرأسي' },
  { t: 13.4, file: '04-exploded.jpg', title: 'عرض مفكّك كامل مع خيوط الضوء' },
  { t: 15.8, file: '05-orbit.jpg', title: 'دوران علوي وتغيير بؤرة' },
  { t: 19.3, file: '06-pulse.jpg', title: 'إعادة التجميع ونبضة الضوء الزرقاء' },
  { t: 22.6, file: '07-hero.jpg', title: 'لقطة البطل ثلاثة أرباع' },
];

const W = 1440;
const H = 810;

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
  ],
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
});

const page = await browser.newPage();
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2', timeout: 90000 });
await page.waitForFunction('window.__kbEngine && window.__kbEngine.renderer', { timeout: 90000 });

// إخفاء كل الواجهة والإبقاء على الكانفس فقط
await page.addStyleTag({
  content: `
    header,.bottom,.heroInner,.kbControls,.kbScrim,.toast{display:none!important}
    main>*:not(.hero){display:none!important}
    body:before,body:after{display:none!important}
    body{overflow:hidden!important;background:#04070f!important}
    .cinemaHero{min-height:100vh!important;height:100vh!important;border-radius:0!important;box-shadow:none!important}
  `,
});
await page.evaluate(() => window.__kbEngine.resize());
await new Promise((r) => setTimeout(r, 2000));

for (const f of FRAMES) {
  await page.evaluate((time) => {
    const e = window.__kbEngine;
    e.pause();
    e.pointer.set(0, 0);
    e.parallax.set(0, 0);
    e.time = time;
    for (let i = 0; i < 3; i++) {
      e.update(0.016, false);
      e.composer.render();
    }
  }, f.t);
  await new Promise((r) => setTimeout(r, 700));
  await page.screenshot({ path: path.join(OUT, f.file), type: 'jpeg', quality: 88 });
  console.log('frame', f.file, '→', f.title);
}

fs.copyFileSync(path.join(OUT, '07-hero.jpg'), path.join(OUT, 'hero-poster.jpg'));
console.log('poster written');

await browser.close();
