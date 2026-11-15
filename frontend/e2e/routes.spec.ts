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
      '/api/settings/product-defaults': { refresh_interval: 43200, instance_refresh_interval: 43200 },
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
  await page.getByRole('button', { name: 'Retry' }).click({ force: true });
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
  await pauseTracking.check({ force: true });

  await page.getByRole('button', { name: 'Price History' }).click({ force: true });
  await expect(page).toHaveURL(/\/products\/1\/history$/);
  await expect.poll(() => productRequests).toBe(1);

  await page.getByRole('button', { name: 'Advanced Settings' }).click({ force: true });
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
    ['/settings/appearance', 'Theme'],
    ['/settings/regional', 'Regional Settings'],
    ['/settings/tracking', 'Default Check Interval'],
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

/**
 * Notification channel credentials are write-only (issue #272).
 *
 * The form loads every field into a draft and PUTs the whole draft, so what it
 * sends for a credential it was never given is the thing that can silently
 * detach a working channel. Checked against the built bundle, because the
 * draft-to-request mapping is the part that only exists at runtime.
 */
test('keeps notification channel credentials write-only', async ({ page }) => {
  await page.addInitScript((user) => {
    localStorage.setItem('token', 'acceptance-token');
    localStorage.setItem('user', JSON.stringify(user));
  }, authenticatedUser);

  const stored = {
    telegram_bot_token: null,
    telegram_chat_id: '987654321',
    telegram_enabled: true,
    has_telegram_bot_token: true,
    has_discord_webhook_url: false,
  };
  const puts: Record<string, unknown>[] = [];

  await page.route('**/api/settings/notifications', async (route) => {
    if (route.request().method() === 'PUT') {
      puts.push(route.request().postDataJSON());
      return route.fulfill({ json: { ...stored, message: 'Notification settings updated successfully' } });
    }
    return route.fulfill({ json: stored });
  });

  await page.goto('/settings/notifications');
  await page.getByRole('button', { name: /Telegram Bot/ }).click();

  // A stored credential shows as set, with the box empty: the value is not
  // returned by the API, so there is nothing to prefill.
  const botToken = page.getByLabel('Bot Token (set)');
  await expect(botToken).toHaveValue('');
  await expect(botToken).toHaveAttribute('placeholder', /leave empty to keep existing/);

  const save = page.getByRole('button', { name: 'Save' });

  // Replacing it sends the typed value, and only that field.
  await botToken.fill('999999:A-NEW-BOT-TOKEN');
  await save.click();
  await expect.poll(() => puts.length).toBe(1);
  expect(puts[0].telegram_bot_token).toBe('999999:A-NEW-BOT-TOKEN');
  expect(puts[0]).not.toHaveProperty('discord_webhook_url');
  // Stored now, so it is not left on screen to be sent again.
  await expect(botToken).toHaveValue('');

  // Removing it is an explicit action and sends null, which empty does not.
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.getByText('Will be removed on save.')).toBeVisible();
  await save.click();
  await expect.poll(() => puts.length).toBe(2);
  expect(puts[1].telegram_bot_token).toBeNull();

  // An unrelated change carries no credential at all.
  await page.locator('.pg-collapsible-card.expanded .toggle-switch').first().click();
  await save.click();
  await expect.poll(() => puts.length).toBe(3);
  expect(puts[2].telegram_enabled).toBe(false);
  expect(puts[2]).not.toHaveProperty('telegram_bot_token');
  expect(puts[2]).not.toHaveProperty('webhook_url');
});

/**
 * A plain-text webhook survives its headers being withheld (issues #268, #272).
 *
 * `webhook_payload_template` is not a credential and comes back in full;
 * `webhook_headers` is one and comes back null. Reading the template's format
 * off the empty Headers field said "JSON", so a working text/plain template was
 * reported as broken -- and the section's single Save then refused every
 * channel. The server sends the format instead.
 */
test('keeps a plain-text webhook template valid when its headers are withheld', async ({ page }) => {
  await page.addInitScript((user) => {
    localStorage.setItem('token', 'acceptance-token');
    localStorage.setItem('user', JSON.stringify(user));
  }, authenticatedUser);

  const stored = {
    telegram_enabled: true,
    webhook_enabled: true,
    webhook_url: null,
    has_webhook_url: true,
    webhook_headers: null,
    has_webhook_headers: true,
    webhook_payload_template: 'Now {{price}} at {{store}}: {{product_url}}',
    webhook_sends_plain_text: true,
  };
  const puts: Record<string, unknown>[] = [];

  await page.route('**/api/settings/notifications', async (route) => {
    if (route.request().method() === 'PUT') {
      puts.push(route.request().postDataJSON());
      return route.fulfill({ json: { ...stored, message: 'ok' } });
    }
    return route.fulfill({ json: stored });
  });

  await page.goto('/settings/notifications');
  await page.getByRole('button', { name: /Generic Webhook/ }).click();

  // The format came from the server, so the plain-text template is accepted.
  await expect(page.getByText('Payload Template (plain text)')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();

  // Stored headers show as set, empty, and removable.
  const headers = page.getByLabel('Headers (set)');
  await expect(headers).toHaveValue('');
  await expect(headers).toHaveAttribute('placeholder', /leave empty to keep existing/);

  // Editing them hands the format back to the draft, and the check still
  // catches a document the backend could not send.
  await headers.fill('{"Authorization": Bearer abc');
  await expect(page.getByText(/Fix before saving/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();

  // Clearing them is explicit and sends null. With the headers gone the webhook
  // sends the default JSON Content-Type, so the plain-text template goes too --
  // and the clear marker itself must not be read as a broken JSON document.
  await page.getByLabel(/Payload Template/).fill('');
  await page.locator('form.form-group', { has: page.locator('#webhook-headers') })
    .getByRole('button', { name: 'Clear' }).click();
  await expect(page.getByText('Will be removed on save.')).toBeVisible();
  await expect(page.getByText(/Fix before saving/)).toHaveCount(0);

  const save = page.getByRole('button', { name: 'Save' });
  await expect(save).toBeEnabled();
  await save.click();
  await expect.poll(() => puts.length).toBe(1);
  expect(puts[0].webhook_headers).toBeNull();
  expect(puts[0].webhook_payload_template).toBe('');
});

/**
 * One Save covers every channel on the page, so a problem in a webhook the user
 * has not touched must not lock the rest of it (issue #272).
 */
test('does not let an untouched webhook block saving another channel', async ({ page }) => {
  await page.addInitScript((user) => {
    localStorage.setItem('token', 'acceptance-token');
    localStorage.setItem('user', JSON.stringify(user));
  }, authenticatedUser);

  const stored = {
    telegram_enabled: true,
    telegram_chat_id: '987654321',
    has_telegram_bot_token: true,
    webhook_enabled: true,
    // Stored through the API, or by an older version: not valid JSON.
    webhook_payload_template: '{"title": {{product_name}}',
    webhook_sends_plain_text: false,
  };
  const puts: Record<string, unknown>[] = [];

  await page.route('**/api/settings/notifications', async (route) => {
    if (route.request().method() === 'PUT') {
      puts.push(route.request().postDataJSON());
      return route.fulfill({ json: { ...stored, message: 'ok' } });
    }
    return route.fulfill({ json: stored });
  });

  await page.goto('/settings/notifications');
  await page.getByRole('button', { name: /Generic Webhook/ }).click();

  // The problem is reported where it is.
  await expect(page.getByText(/Fix before saving/).first()).toBeVisible();

  // A change to another channel still saves.
  await page.getByRole('button', { name: /Telegram Bot/ }).click();
  await page.locator('.pg-collapsible-card', { hasText: 'Telegram Bot' })
    .locator('.toggle-switch').first().click();
  const save = page.getByRole('button', { name: 'Save' });
  await expect(save).toBeEnabled();
  await save.click();
  await expect.poll(() => puts.length).toBe(1);
  expect(puts[0].telegram_enabled).toBe(false);
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
  await page.getByRole('button', { name: 'Alert History' }).click({ force: true });
  await expect(page.getByText('Price dropped')).toBeVisible();
  await page.getByRole('button', { name: 'Mark all read' }).click({ force: true });
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
  await page.getByRole('button', { name: 'Stop Tracking' }).first().click({ force: true });
  await page.getByRole('button', { name: 'Stop Tracking' }).last().click({ force: true });
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByText('No tracked products yet')).toBeVisible();
});

test('renders currency and dates without throwing when user locale is null', async ({ page }) => {
  const nullLocaleUser = { ...authenticatedUser, locale: null };
  const pageErrors: Error[] = [];
  page.on('pageerror', (err) => pageErrors.push(err));

  await page.addInitScript((user) => {
    localStorage.setItem('token', 'acceptance-token');
    localStorage.setItem('user', JSON.stringify(user));
  }, nullLocaleUser);

  await page.route('**/api/profile', async (route) => {
    await route.fulfill({ json: { ...nullLocaleUser, categories: ['Games'] } });
  });
  await page.route('**/api/products/1', async (route) => {
    await route.fulfill({ json: product });
  });

  await page.goto('/products');
  await expect(page.getByText('Acceptance Product')).toBeVisible();
  await expect(page.getByText('$25.00')).toBeVisible();

  await page.goto('/products/1');
  await expect(page.getByRole('heading', { name: 'Acceptance Product' })).toBeVisible();

  await page.goto('/settings/profile');
  await expect(page.getByRole('heading', { name: 'User Profile' })).toBeVisible();

  expect(pageErrors).toHaveLength(0);
});

test('toggles background particle animations and persists preference', async ({ page }) => {
  await page.addInitScript((user) => {
    localStorage.setItem('token', 'acceptance-token');
    localStorage.setItem('user', JSON.stringify(user));
  }, authenticatedUser);

  await page.goto('/settings/appearance');
  await expect(page.getByRole('heading', { name: 'Background Animations' })).toBeVisible();

  await page.getByRole('button', { name: 'Disabled' }).click();
  await expect(page.locator('.particle-background')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('background-particles'))).toBe('disabled');

  await page.getByRole('button', { name: 'Enabled' }).click();
  await expect(page.locator('.particle-background')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('background-particles'))).toBe('enabled');
});
