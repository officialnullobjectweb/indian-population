import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';

const execFileAsync = promisify(execFile);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect.poll(
    async () => page.locator('#map-holder svg path').count(),
    { timeout: 30000 }
  ).toBeGreaterThan(0);
});

test('loads the india view with all states', async ({ page }) => {
  await expect(page).toHaveTitle(/Census 2011/);
  await expect(page.locator('#map-holder svg path')).toHaveCount(35);
  await expect(page.locator('#status')).toContainText('640 districts');
  await expect(page.locator('#stat-districts')).toContainText('640');
  await expect(page.locator('#stat-pop')).not.toContainText('…');
});

test('makes no external network requests', async ({ page }) => {
  const external = [];
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith('http://localhost:') && !url.startsWith('data:') && !url.startsWith('blob:')) {
      external.push(url);
    }
  });
  await page.reload();
  await expect.poll(
    async () => page.locator('#map-holder svg path').count(),
    { timeout: 30000 }
  ).toBeGreaterThan(0);
  // drill + focus also stay local
  await page.getByLabel(/Karnataka, population/).click();
  await expect(page.locator('#map-holder svg path')).toHaveCount(30);
  expect(external).toEqual([]);
});

test('drills from india into state districts', async ({ page }) => {
  await page.getByLabel(/Karnataka, population/).click();
  await expect(page.locator('#map-holder svg path')).toHaveCount(30);
  await expect(page.locator('#crumb')).toHaveText('India / Karnataka');
  await expect(page.locator('#back-btn')).toBeVisible();
});

test('focuses a district on click and unfocuses on second click', async ({ page }) => {
  await page.getByLabel(/Karnataka, population/).click();
  await page.getByLabel(/^Mysore, Population/).click();
  await expect(page.locator('#crumb')).toHaveText('India / Karnataka / Mysore');
  await expect(page.locator('#map-holder svg path.focused')).toHaveCount(1);
  await expect(page.locator('#dp-title')).toHaveText('Mysore');
  await page.getByLabel(/^Mysore, Population/).click();
  await expect(page.locator('#crumb')).toHaveText('India / Karnataka');
  await expect(page.locator('#map-holder svg path.focused')).toHaveCount(0);
});

test('back button walks district -> state -> india', async ({ page }) => {
  await page.getByLabel(/Karnataka, population/).click();
  await page.getByLabel(/^Mysore, Population/).click();
  await expect(page.locator('#crumb')).toHaveText('India / Karnataka / Mysore');
  await page.getByRole('button', { name: /Back to Karnataka/ }).click();
  await expect(page.locator('#crumb')).toHaveText('India / Karnataka');
  await page.getByRole('button', { name: /Back to India/ }).click();
  await expect(page.locator('#crumb')).toHaveText('India');
  await expect(page.locator('#map-holder svg path')).toHaveCount(35);
});

test('metric dropdown recolors districts', async ({ page }) => {
  await page.getByLabel(/Karnataka, population/).click();
  await page.getByRole('button', { name: /Colour by/ }).click();
  await page.getByRole('option', { name: /Literacy rate/ }).click();
  await expect(page.getByRole('button', { name: /Colour by/ })).toContainText('Literacy rate');
  await expect(page.locator('#map-holder svg path').first()).toHaveAttribute('aria-label', /Literacy rate/);
});

test('theme toggle flips and persists', async ({ page }) => {
  const btn = page.getByRole('button', { name: /Switch to (dark|light) mode/ });
  const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await btn.click();
  const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  expect(after).not.toBe(before);
  const stored = await page.evaluate(() => localStorage.getItem('india-map-theme'));
  expect(stored).toBe(after);
  await page.reload();
  await expect.poll(
    async () => page.evaluate(() => document.documentElement.getAttribute('data-theme')),
    { timeout: 10000 }
  ).toBe(after);
});

test('unmatched districts show the no-data fallback', async ({ page }) => {
  await page.getByLabel(/Jammu and Kashmir, population/).click();
  await expect(page.locator('#status')).toContainText('1 without data');
  const labels = await page.locator('#map-holder svg path').evaluateAll((els) =>
    els.map((el) => el.getAttribute('aria-label'))
  );
  expect(labels.some((l) => l && l.includes('Data not available'))).toBe(true);
});

test('clean-data pipeline produces numeric district json', async () => {
  const { stdout } = await execFileAsync('node', ['scripts/clean-data.js'], { cwd: process.cwd() });
  expect(stdout).toMatch(/wrote 640 districts/);
  const json = JSON.parse(fs.readFileSync('src/data/districts.json', 'utf8'));
  expect(json.districts).toHaveLength(640);
  expect(json.districts.every((d) => typeof d.population === 'number')).toBe(true);
  expect(json.districts.every((d) => d.state_norm && d.district_norm)).toBe(true);
});
