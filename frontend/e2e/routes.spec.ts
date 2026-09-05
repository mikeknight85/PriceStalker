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
      // Present so the grouped view and the linking action see the shape they
      // expect. Without it the catch-all below answers `{}`, which is not the
      // list they are typed for.
      '/api/products/items': [],
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

test('clears an expired session and redirects a protected API request to login', async ({ page }) => {
  await page.addInitScript((user) => {
    if (sessionStorage.getItem('expired-session-seeded')) return;
    sessionStorage.setItem('expired-session-seeded', 'true');
    localStorage.setItem('token', 'expired-token');
    localStorage.setItem('user', JSON.stringify(user));
  }, authenticatedUser);
  await page.route('**/api/products', async (route) => {
    await route.fulfill({ status: 401, json: { error: 'Expired token' } });
  });

  await page.goto('/products');

  await expect(page).toHaveURL(/\/login\?redirect=/);
  await page.waitForLoadState('domcontentloaded');
  await expect(page.evaluate(() => localStorage.getItem('token'))).resolves.toBeNull();
  await expect(page.evaluate(() => localStorage.getItem('user'))).resolves.toBeNull();
});

test('shows a retryable dashboard error instead of the empty state', async ({ page }) => {
  let failRequests = true;
  await page.addInitScript((user) => {
    localStorage.setItem('token', 'acceptance-token');
    localStorage.setItem('user', JSON.stringify(user));
  }, authenticatedUser);
  await page.route('**/api/products', async (route) => {
    if (failRequests) {
      await route.fulfill({ status: 500, json: { error: 'Temporary failure' } });
      return;
    }
    await route.fulfill({ json: [product] });
  });

  await page.goto('/products');
  await expect(page.getByText('Failed to load products. Please try again.')).toBeVisible();
  await expect(page.getByText('No products found')).not.toBeVisible();

  failRequests = false;
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByText('Acceptance Product')).toBeVisible();
});

test('falls back from an unknown route to the protected products flow', async ({ page }) => {
  await page.goto('/not-a-route');

  await expect(page).toHaveURL(/\/login\?redirect=/);
});

test('uses canonical defaults when retired tab state is supplied', async ({ page }) => {
  await page.addInitScript((user) => {
    localStorage.setItem('token', 'acceptance-token');
    localStorage.setItem('user', JSON.stringify(user));
  }, adminUser);

  await page.goto('/?tab=stats');
  await expect(page).toHaveURL(/\/products$/);

  await page.goto('/settings?tab=security');
  await expect(page).toHaveURL(/\/settings\/profile$/);

  await page.goto('/admin?tab=logs');
  await expect(page).toHaveURL(/\/admin\/system$/);
});

test('uses the preloaded detail cache while preserving state across nested sections', async ({ page }) => {
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
  await expect(page.locator('.detail-section-tabs')).toHaveCSS('display', 'flex');
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

test('exposes product creation from the products dashboard', async ({ page }) => {
  await page.addInitScript((user) => {
    localStorage.setItem('token', 'acceptance-token');
    localStorage.setItem('user', JSON.stringify(user));
  }, authenticatedUser);

  await page.goto('/products');
  const addProductLinks = page.getByRole('link', { name: 'Add Product' });
  await expect(addProductLinks).toHaveCount(2);
  await expect(addProductLinks.first()).toHaveAttribute('href', '/products/new');
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

test('lists notification history and marks every alert as read', async ({ page }) => {
  await page.addInitScript((user) => {
    localStorage.setItem('token', 'acceptance-token');
    localStorage.setItem('user', JSON.stringify(user));
  }, authenticatedUser);
  let readAllRequests = 0;
  const alert = { id: 9, user_id: 1, type: 'price_drop', title: 'Price dropped', message: 'Now $20', is_read: false, data: {}, created_at: '2026-01-01T00:00:00.000Z' };
  await page.route('**/api/notifications/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/notifications/history') return route.fulfill({ json: { notifications: [alert], pagination: { page: 1, limit: 20, totalCount: 1, totalPages: 1 } } });
    if (path === '/api/notifications/read-all' && request.method() === 'POST') {
      readAllRequests += 1;
      return route.fulfill({ json: {} });
    }
    return route.fulfill({ json: { notifications: [], unreadCount: 0 } });
  });

  await page.goto('/notifications');
  await page.getByRole('button', { name: 'Alert History' }).click();
  await expect(page.getByText('Price dropped')).toBeVisible();
  await page.getByRole('button', { name: 'Mark all read' }).click();
  await expect.poll(() => readAllRequests).toBe(1);
});

test('removes a deleted detail product from the dashboard cache', async ({ page }) => {
  await page.addInitScript((user) => {
    localStorage.setItem('token', 'acceptance-token');
    localStorage.setItem('user', JSON.stringify(user));
  }, authenticatedUser);
  let deleted = false;
  await page.route('**/api/products/1', async (route) => {
    if (route.request().method() === 'DELETE') {
      deleted = true;
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ json: { ...product, stats: { min_price: 25, max_price: 25, avg_price: 25, price_count: 1 } } });
  });
  await page.route('**/api/products', async (route) => route.fulfill({ json: deleted ? [] : [product] }));
  await page.goto('/products/1');
  await page.getByRole('button', { name: 'Stop Tracking' }).click();
  await page.getByRole('button', { name: 'Stop Tracking' }).last().click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByText('Acceptance Product')).not.toBeVisible();
});
