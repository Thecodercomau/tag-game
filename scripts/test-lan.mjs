import assert from 'node:assert/strict';
import os from 'node:os';
import { chromium } from '@playwright/test';

const port = Number(process.env.PORT || 3000);

function findLanUrl() {
  if (process.env.LAN_URL) return process.env.LAN_URL.replace(/\/$/, '');
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) return `http://${entry.address}:${port}`;
    }
  }
  throw new Error('No LAN IPv4 address found. Set LAN_URL to run this smoke test.');
}

function watch(page, label, errors) {
  page.on('pageerror', (error) => errors.push(`${label}: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${label}: ${message.text()}`);
  });
}

const base = findLanUrl();
const browser = await chromium.launch();
const contexts = [];
const errors = [];

try {
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.ok, true, `Health check failed for ${base}`);
  const info = await (await fetch(`${base}/api/server-info`)).json();
  assert.ok(info.lanUrls.some((entry) => base.startsWith(entry.url)), `${base} is not a reported LAN address`);

  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  contexts.push(hostContext, guestContext);
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  watch(host, 'host', errors);
  watch(guest, 'guest', errors);

  await host.goto(base);
  await host.click('[data-action="online"]');
  await host.locator('.connection-banner').filter({ hasText: 'Connected' }).waitFor();
  await host.locator('[data-form="create-room"] button[type="submit"]').click();
  const lanUrl = host.locator('.lan-url');
  await lanUrl.waitFor();
  const code = (await lanUrl.innerText()).trim();
  assert.match(code, /^[A-Z0-9]{5}$/, `Unexpected room code: ${code}`);

  await guest.goto(base);
  await guest.click('[data-action="online"]');
  await guest.locator('.connection-banner').filter({ hasText: 'Connected' }).waitFor();
  await guest.fill('#join-code', code);
  await guest.locator('[data-form="join-code"] button[type="submit"]').click();
  await guest.locator('[data-action="toggle-ready"]').waitFor();
  await host.locator('[data-action="toggle-ready"]').click();
  await guest.locator('[data-action="toggle-ready"]').click();
  await host.locator('[data-action="start-match"]:not([disabled])').waitFor();
  await host.locator('[data-action="start-match"]').click();
  await host.locator('body.in-game').waitFor();
  await guest.locator('body.in-game').waitFor();
  await host.locator('#hud-root').waitFor();
  await guest.locator('#hud-root').waitFor();

  await host.click('[data-action="game-pause"]');
  await host.click('.pause-card [data-action="pause-leave"]');
  await guest.locator('.results-overlay').waitFor({ timeout: 8000 });
  const results = await guest.locator('.results-overlay').innerText();
  assert.match(results, /WIN|Victory|Match complete/, 'Guest did not receive match results');
  await guest.click('[data-action="results-lobby"]');
  await guest.locator('.btn.danger[data-action="leave-lobby"]').waitFor();

  await hostContext.close();
  await guestContext.close();

  let lobbies = -1;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const stats = await (await fetch(`${base}/api/stats`)).json();
    lobbies = stats.lobbies.length;
    if (lobbies === 0) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(lobbies, 0, 'LAN smoke test left stale lobbies behind');
  assert.deepEqual(errors, []);

  console.log(`LAN smoke test passed over ${base}`);
  console.log(`Created room ${code}, joined and started a two-player match, received results, and cleaned up.`);
} finally {
  for (const context of contexts) await context.close().catch(() => {});
  await browser.close();
}
