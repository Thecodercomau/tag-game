import { expect, test } from '@playwright/test';

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

test('customizes a runner and handles pause-menu settings in practice', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.locator('.hero-title')).toContainText('TAG');

  await page.click('[data-action="customize"]');
  await page.fill('#profile-name', 'E2E Runner');
  await page.press('#profile-name', 'Tab');
  await page.locator('[data-action="pick-character"]').nth(1).click();
  await page.locator('[data-action="pick-palette"]').nth(3).click();

  const profile = await page.evaluate(() => JSON.parse(localStorage.getItem('tag.profile.v1')));
  expect(profile.name).toBe('E2E Runner');
  expect(profile.characterId).toBe('comet');
  expect(profile.paletteId).toBe('arcade');

  await page.reload();
  await expect(page.locator('.profile-mini')).toContainText('E2E Runner');

  await page.click('[data-action="practice"]');
  await page.click('[data-action="practice-start"]');
  await expect(page.locator('body')).toHaveClass(/in-game/);
  await expect(page.locator('#hud-root')).toBeVisible();

  await page.click('[data-action="game-pause"]');
  await expect(page.locator('#overlay-root')).toContainText('Paused');
  await page.click('.pause-card [data-action="settings"]');
  await expect(page.locator('body')).toHaveClass(/pause-settings/);
  await expect(page.locator('#screen-root')).toBeVisible();
  await expect(page.locator('#hud-root')).toBeHidden();
  await page.click('[data-action="settings-tab"][data-tab="controls"]');
  await expect(page.locator('#screen-root')).toContainText('Click a key to rebind it');

  await page.click('.back-btn');
  await expect(page.locator('body')).not.toHaveClass(/pause-settings/);
  await expect(page.locator('#overlay-root')).toContainText('Resume');
  await page.click('[data-action="pause-resume"]');
  await expect(page.locator('#overlay-root')).toBeEmpty();

  await page.click('[data-action="game-pause"]');
  await page.click('.pause-card [data-action="pause-leave"]');
  await expect(page.locator('body')).not.toHaveClass(/in-game/);
  await expect(page.locator('.hero-title')).toContainText('TAG');
  expect(errors).toEqual([]);
});

test('rebinds controls, swaps conflicts, and persists the result', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.click('[data-action="settings"]');
  await page.click('[data-action="settings-tab"][data-tab="controls"]');
  const tagKey = page.locator('[data-action="remap-key"][data-binding-action="tag"]').first();
  await tagKey.click();
  await expect(tagKey).toHaveText('Press…');
  await page.keyboard.press('KeyE');
  await expect(page.locator('[data-action="remap-key"][data-binding-action="tag"]').first()).toHaveText('E');
  const bindings = await page.evaluate(() => JSON.parse(localStorage.getItem('tag.settings.v1')).bindings);
  expect(bindings.tag).toEqual(['KeyE']);
  expect(bindings.interact).toEqual(['Space']);

  await page.reload();
  await page.click('[data-action="settings"]');
  await page.click('[data-action="settings-tab"][data-tab="controls"]');
  await expect(page.locator('[data-action="remap-key"][data-binding-action="tag"]').first()).toHaveText('E');
  expect(errors).toEqual([]);
});

test('navigates every menu screen and returns with the back control', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  const destinations = [
    ['customize', 'Customize'],
    ['stats', 'Stats'],
    ['how', 'How to play'],
    ['settings', 'Settings'],
    ['lan', 'LAN'],
    ['online', 'Play online'],
    ['practice', 'Practice']
  ];
  for (const [action, heading] of destinations) {
    await page.click(`[data-action="${action}"]`).catch(async () => {
      await page.click(`.menu-item[data-action="${action}"], .nav-panel [data-action="${action}"]`);
    });
    await expect(page.locator('.page-title')).toContainText(heading);
    await page.click('.back-btn');
    await expect(page.locator('.hero-title')).toContainText('TAG');
  }
  expect(errors).toEqual([]);
});

test('hosts and starts a two-player online match', async ({ browser, request }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const errors = [...watchErrors(host), ...watchErrors(guest)];

  await host.goto('/');
  await host.click('[data-action="online"]');
  await expect(host.locator('.connection-banner')).toContainText('Connected');
  await host.locator('[data-form="create-room"] button[type="submit"]').click();
  await expect(host.locator('.lan-url')).toBeVisible();
  const code = (await host.locator('.lan-url').innerText()).trim();
  expect(code).toMatch(/^[A-Z0-9]{5}$/);

  await guest.goto('/');
  await guest.click('[data-action="online"]');
  await guest.fill('#join-code', code);
  await guest.locator('[data-form="join-code"] button[type="submit"]').click();
  await expect(guest.locator('[data-action="toggle-ready"]')).toBeVisible();
  await expect(host.locator('[data-action="toggle-ready"]')).toBeVisible();

  await host.click('[data-action="toggle-ready"]');
  await guest.click('[data-action="toggle-ready"]');
  await expect(host.locator('[data-action="start-match"]')).toBeEnabled();
  await host.click('[data-action="start-match"]');
  await expect(host.locator('body')).toHaveClass(/in-game/);
  await expect(guest.locator('body')).toHaveClass(/in-game/);
  await expect(host.locator('#hud-root')).toBeVisible();
  await expect(guest.locator('#hud-root')).toBeVisible();

  await host.click('[data-action="game-pause"]');
  await host.click('.pause-card [data-action="pause-leave"]');
  await expect(host.locator('body')).not.toHaveClass(/in-game/);
  expect(errors).toEqual([]);

  await hostContext.close();
  await guestContext.close();
  await expect.poll(async () => {
    const response = await request.get('/api/stats');
    return (await response.json()).lobbies.length;
  }).toBe(0);
});

test.describe('mobile layout', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('starts practice without overflow and exposes touch controls', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await expect(page.locator('.hero-title')).toContainText('TAG');
    await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(true);

    await page.click('[data-action="practice"]');
    await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(true);
    await page.click('[data-action="practice-start"]');
    await expect(page.locator('body')).toHaveClass(/in-game/);
    await expect(page.locator('[data-touch="tag"]')).toBeVisible();
    await expect(page.locator('[data-touch="sprint"]')).toBeVisible();
    await expect(page.locator('[data-touch="interact"]')).toHaveClass(/hidden/);
    await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(true);
    expect(errors).toEqual([]);
  });
});
