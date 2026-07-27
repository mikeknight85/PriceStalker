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
      '/api/auth/oidc/config/public': {
        policy: 'local',
        oidc_enabled: false,
        oidc_provider_name: null,
      },
      '/api/products': [],
      '/api/profile': { categories: [] },
      '/api/notifications/recent': { notifications: [] },
    };

    await route.fulfill({ json: responses[path] ?? {} });
  });
});

test('renders the public login and registration routes', async ({ page }) => {
  await page.goto('/login?local=1');
  await expect(page.getByRole('heading', { name: 'PriceStalker' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();

  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'PriceStalker' })).toBeVisible();
  await expect(page.getByLabel('Confirm Password')).toBeVisible();
});

test('redirects unauthenticated protected routes to login with a return URL', async ({ page }) => {
  await page.goto('/settings?tab=security');

  await expect(page).toHaveURL(/\/login\?redirect=/);
  await expect(page.getByRole('heading', { name: 'PriceStalker' })).toBeVisible();
});

test('falls back from an unknown route to the protected dashboard flow', async ({ page }) => {
  await page.goto('/not-a-route');

  await expect(page).toHaveURL(/\/login\?redirect=/);
});

test('uses the dashboard default tab for malformed URL state', async ({ page }) => {
  await page.addInitScript((user) => {
    localStorage.setItem('token', 'acceptance-token');
    localStorage.setItem('user', JSON.stringify(user));
  }, authenticatedUser);

  await page.goto('/?tab=not-a-dashboard-tab');

  await expect(page.getByRole('button', { name: 'Tracked Products' })).toHaveClass(/active/);
  await expect(page.getByRole('button', { name: 'Add New Product' })).not.toHaveClass(/active/);
});
