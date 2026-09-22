import { expect, test } from '@playwright/test';

const authenticatedUser = {
  id: 1,
  email: 'acceptance@example.test',
  name: 'Acceptance User',
  currency: 'USD',
  locale: 'en-US',
  is_admin: false,
  categories: [],
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const responses: Record<string, unknown> = {
      '/api/auth/registration-status': { enabled: true },
      '/api/auth/oidc/config/public': { policy: 'local', oidc_enabled: false, oidc_provider_name: null },
      '/api/products': [],
      '/api/products/items': [],
      '/api/profile': { ...authenticatedUser, categories: ['Games'] },
      '/api/settings/currencies': [],
      '/api/settings/notifications': {},
      '/api/notifications/recent': { notifications: [] },
    };
    await route.fulfill({ json: responses[path] ?? {} });
  });
  await page.addInitScript((user) => {
    localStorage.setItem('token', 'acceptance-token');
    localStorage.setItem('user', JSON.stringify(user));
  }, authenticatedUser);
});

const NARROW = { width: 600, height: 900 };
const WIDE = { width: 1400, height: 900 };

async function gotoProfile(page: import('@playwright/test').Page) {
  await page.goto('/settings/profile');
  await expect(page.getByRole('heading', { name: 'Layout' })).toBeVisible();
}

test('auto at a narrow width keeps the mobile layout (unchanged behaviour)', async ({ page }) => {
  await page.setViewportSize(NARROW);
  await gotoProfile(page);
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-layout'))).toBe(false);
  await expect(page.locator('.settings-sidebar-new')).toBeHidden();
  await expect(page.locator('.settings-mobile-select')).toBeVisible();
});

test('auto at a wide width keeps the desktop layout (unchanged behaviour)', async ({ page }) => {
  await page.setViewportSize(WIDE);
  await gotoProfile(page);
  await expect(page.locator('.settings-sidebar-new')).toBeVisible();
  await expect(page.locator('.settings-mobile-select')).toBeHidden();
});

test('forcing desktop at a narrow width renders the desktop layout and scrolls sideways', async ({ page }) => {
  await page.setViewportSize(NARROW);
  await gotoProfile(page);
  await page.getByRole('button', { name: 'Desktop', exact: true }).click();

  expect(await page.evaluate(() => document.documentElement.getAttribute('data-layout'))).toBe('desktop');
  await expect(page.locator('.settings-sidebar-new')).toBeVisible();
  await expect(page.locator('.settings-mobile-select')).toBeHidden();

  // The viewport meta is rewritten too: that is what carries the override into
  // stylesheets this change does not touch, on a real phone or tablet.
  expect(await page.evaluate(() => document.querySelector('meta[name=viewport]')?.getAttribute('content')))
    .toBe('width=1280, viewport-fit=cover');

  // It must genuinely scroll, not clip.
  const scroll = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth);
  await page.evaluate(() => window.scrollTo(400, 0));
  expect(await page.evaluate(() => window.scrollX)).toBeGreaterThan(0);
});

test('forcing mobile at a wide width renders the mobile layout', async ({ page }) => {
  await page.setViewportSize(WIDE);
  await gotoProfile(page);
  await page.getByRole('button', { name: 'Mobile', exact: true }).click();

  expect(await page.evaluate(() => document.documentElement.getAttribute('data-layout'))).toBe('mobile');
  await expect(page.locator('.settings-sidebar-new')).toBeHidden();
  await expect(page.locator('.settings-mobile-select')).toBeVisible();
  await expect(page.locator('.navbar-email').first()).toBeHidden();
  const layoutButtons = page.locator('.settings-card button[aria-pressed]');
  await expect(layoutButtons).toHaveCount(3);
  await expect(layoutButtons.nth(0)).toHaveAttribute('aria-pressed', 'false');
  await expect(layoutButtons.nth(2)).toHaveAttribute('aria-pressed', 'true');
  await expect(layoutButtons.nth(2)).toHaveClass(/btn-primary/);
  await expect(layoutButtons.nth(0)).toHaveClass(/btn-secondary/);
});

test('the choice survives a reload and can be returned to auto', async ({ page }) => {
  await page.setViewportSize(NARROW);
  await gotoProfile(page);
  await page.getByRole('button', { name: 'Desktop', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Layout' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-layout'))).toBe('desktop');
  await expect(page.locator('.settings-sidebar-new')).toBeVisible();

  await page.getByRole('button', { name: 'Auto', exact: true }).nth(1).click();
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-layout'))).toBe(false);
  await expect(page.locator('.settings-sidebar-new')).toBeHidden();
  expect(await page.evaluate(() => document.querySelector('meta[name=viewport]')?.getAttribute('content')))
    .toBe('width=device-width, initial-scale=1.0, viewport-fit=cover');
  expect(await page.evaluate(() => window.localStorage.getItem('layout'))).toBeNull();
});
