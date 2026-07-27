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

const adminUser = { ...authenticatedUser, is_admin: true };

const product = {
  id: 1,
  name: 'Acceptance Product',
  url: 'https://example.test/product',
  category: 'Games',
  current_price: 25,
  currency: 'USD',
  checking_paused: false,
  stock_status: 'in_stock',
  sparkline: [],
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
      '/api/products': [product],
      '/api/profile': { ...authenticatedUser, categories: ['Games'] },
      '/api/settings/currencies': [],
      '/api/settings/notifications': {},
      '/api/notifications/recent': { notifications: [] },
      '/api/admin/debug/status': { enabled: false },
      '/api/admin/settings': {},
      '/api/admin/retailers': [],
      '/api/admin/users': [],
      '/api/admin/system-tokens': [],
      '/api/admin/logs': { logs: [], total: 0, page: 1, pages: 1 },
      '/api/admin/settings/ai': {},
      '/api/admin/settings/ai/gemini/models': { models: [], refreshed_at: '' },
      '/api/admin/auth': {
        policy: 'local', oidc_enabled: false, oidc_provider_name: null,
        oidc_issuer_url: null, oidc_client_id: null, has_client_secret: false,
        oidc_scopes: 'openid email profile', oidc_jit_enabled: false,
        oidc_require_email_verified: true, updated_at: '',
      },
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
  await page.goto('/settings/security');

  await expect(page).toHaveURL(/\/login\?redirect=/);
  await expect(page.getByRole('heading', { name: 'PriceStalker' })).toBeVisible();
});

test('falls back from an unknown route to the protected products flow', async ({ page }) => {
  await page.goto('/not-a-route');

  await expect(page).toHaveURL(/\/login\?redirect=/);
});

test('redirects legacy dashboard URLs to their canonical routes', async ({ page }) => {
  await page.addInitScript((user) => {
    localStorage.setItem('token', 'acceptance-token');
    localStorage.setItem('user', JSON.stringify(user));
  }, authenticatedUser);

  await page.goto('/?tab=stats');
  await expect(page).toHaveURL(/\/insights$/);

  await page.goto('/settings?tab=security');
  await expect(page).toHaveURL(/\/settings\/security$/);

  await page.goto('/?category=Games');
  await expect(page).toHaveURL(/\/products\?category=Games$/);
  await expect(page.getByText('Showing 1 product in Games')).toBeVisible();
});

test('keeps debug routes behind the admin boundary', async ({ page }) => {
  await page.addInitScript((user) => {
    localStorage.setItem('token', 'acceptance-token');
    localStorage.setItem('user', JSON.stringify(user));
  }, authenticatedUser);

  await page.goto('/debug');
  await expect(page).toHaveURL(/\/products$/);
});

test('preserves product detail state while changing nested sections', async ({ page }) => {
  let productRequests = 0;
  await page.addInitScript((user) => {
    localStorage.setItem('token', 'acceptance-token');
    localStorage.setItem('user', JSON.stringify(user));
  }, authenticatedUser);
  await page.route('**/api/products/1', async (route) => {
    productRequests += 1;
    await route.fulfill({ json: product });
  });
  await page.route('**/api/prices/1/history**', async (route) => {
    await route.fulfill({ json: { product, prices: [] } });
  });
  await page.route('**/api/settings/notifications', async (route) => {
    await route.fulfill({ json: {} });
  });

  await page.goto('/products/1/settings');
  const pauseTracking = page.getByLabel('Pause Tracking (Disable scheduled checks)');
  await expect(pauseTracking).toBeVisible();
  await pauseTracking.check();

  await page.getByRole('button', { name: 'Price History' }).click();
  await expect(page).toHaveURL(/\/products\/1\/history$/);
  await expect.poll(() => productRequests).toBe(1);

  await page.getByRole('button', { name: 'Advanced Settings' }).click();
  await expect(page).toHaveURL(/\/products\/1\/settings$/);
  await expect(pauseTracking).toBeChecked();
});

test('renders each canonical application destination for an authenticated user', async ({ page }) => {
  await page.addInitScript((user) => {
    localStorage.setItem('token', 'acceptance-token');
    localStorage.setItem('user', JSON.stringify(user));
  }, authenticatedUser);

  await page.goto('/products');
  await expect(page.getByText('Acceptance Product')).toBeVisible();

  await page.goto('/products/new');
  await expect(page.getByRole('heading', { name: 'Track a New Product' })).toBeVisible();

  await page.goto('/insights');
  await expect(page.getByText('Tracking Overview')).toBeVisible();

  await page.goto('/notifications');
  await expect(page.getByRole('button', { name: 'Session Activity' })).toBeVisible();
});

test('renders every settings section at its canonical path', async ({ page }) => {
  await page.addInitScript((user) => {
    localStorage.setItem('token', 'acceptance-token');
    localStorage.setItem('user', JSON.stringify(user));
  }, authenticatedUser);

  for (const [path, heading] of [
    ['/settings/profile', 'User Profile'],
    ['/settings/regional', 'Regional Settings'],
    ['/settings/notifications', 'Notification Channels'],
    ['/settings/security', 'Security & Password'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }
});

test('allows admins into every admin section and exposes guarded debug', async ({ page }) => {
  await page.addInitScript((user) => {
    localStorage.setItem('token', 'acceptance-token');
    localStorage.setItem('user', JSON.stringify(user));
  }, adminUser);

  for (const path of ['system', 'selectors', 'retailers', 'users', 'tokens', 'auth', 'ai', 'logs']) {
    await page.goto(`/admin/${path}`);
    await expect(page.getByRole('heading', { name: 'System Administration' })).toBeVisible();
  }

  await page.goto('/admin/debug');
  await expect(page.getByRole('heading', { name: 'Debug Access Restricted' })).toBeVisible();
});

test('maps legacy product-detail sections to their nested routes', async ({ page }) => {
  await page.addInitScript((user) => {
    localStorage.setItem('token', 'acceptance-token');
    localStorage.setItem('user', JSON.stringify(user));
  }, authenticatedUser);

  for (const [section, destination] of [
    ['overview', '/products/1'],
    ['chart', '/products/1/history'],
    ['stock', '/products/1/stock'],
    ['notifications', '/products/1/notifications'],
    ['settings', '/products/1/settings'],
  ] as const) {
    await page.goto(`/product/1?section=${section}`);
    await expect(page).toHaveURL(new RegExp(`${destination}$`));
  }
});
