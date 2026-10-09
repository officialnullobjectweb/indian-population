// Capture premium docs assets from the real app: screenshots + a demo tour video.
// Usage: node scripts/capture-assets.mjs [baseUrl]   (default http://localhost:8136)
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:8136';
const browser = await chromium.launch();

async function shot(name, setup, w = 1280, h = 800, scheme = 'light') {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
  const page = await ctx.newPage();
  await page.goto(BASE + '/');
  await page.locator('#map-holder svg path').first().waitFor({ timeout: 30000 });
  await setup(page);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `docs/${name}`, fullPage: false });
  await ctx.close();
  console.log('saved docs/' + name);
}

const drillKarnataka = async (page) => {
  await page.getByLabel(/Karnataka, population/).click();
  await page.waitForTimeout(800);
};
const focusMysore = async (page) => {
  await page.getByLabel(/^Mysore, Population/).click();
  await page.waitForTimeout(900);
};

fs.mkdirSync('docs', { recursive: true });
await shot('og-image.png', async () => {}, 1200, 630, 'light');
await shot('screenshot-india.png', async () => {});
await shot('screenshot-india-dark.png', async () => {}, 1280, 800, 'dark');
await shot('screenshot-districts.png', drillKarnataka);
await shot('screenshot-focus.png', async (page) => { await drillKarnataka(page); await focusMysore(page); });
await shot('screenshot-mobile.png', async () => {}, 390, 844, 'light');

// Demo tour video (desktop, light).
const vctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  colorScheme: 'light',
  recordVideo: { dir: 'docs/.tmp-video', size: { width: 1280, height: 800 } },
});
const vp = await vctx.newPage();
await vp.goto(BASE + '/');
await vp.locator('#map-holder svg path').first().waitFor({ timeout: 30000 });
await vp.waitForTimeout(1000);
await drillKarnataka(vp);
await vp.waitForTimeout(600);
await focusMysore(vp);
await vp.waitForTimeout(600);
await vp.getByRole('button', { name: /Colour by/ }).click();
await vp.waitForTimeout(400);
await vp.getByRole('option', { name: /Literacy rate/ }).click();
await vp.waitForTimeout(1000);
await vp.getByRole('button', { name: /Back to Karnataka/ }).click();
await vp.waitForTimeout(800);
await vp.getByRole('button', { name: /Back to India/ }).click();
await vp.waitForTimeout(800);
await vp.close();
await vctx.close();
const tmp = fs.readdirSync('docs/.tmp-video').find((f) => f.endsWith('.webm'));
fs.renameSync(`docs/.tmp-video/${tmp}`, 'docs/demo.webm');
fs.rmdirSync('docs/.tmp-video');
await browser.close();
const kb = Math.round(fs.statSync('docs/demo.webm').size / 1024);
console.log(`saved docs/demo.webm (${kb} KB)`);
