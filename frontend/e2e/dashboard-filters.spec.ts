import { expect, test } from '@playwright/test';

/**
 * The dashboard's tracking and stock filters, in both views (issues #246, #248).
 *
 * Covered end to end rather than only in unit tests because the defect these
 * replace was never in a predicate: the grouped view simply never received the
 * filter, so the dropdown moved and nothing happened. Only driving the real
 * controls against both views can catch that coming back.
 */

const authenticatedUser = {
  id: 1,
  email: 'acceptance@example.test',
  name: 'Acceptance User',
  currency: 'USD',
  locale: 'en-US',
  is_admin: false,
  categories: [],
};

function listing(overrides: Record<string, unknown>) {
  return {
    user_id: 1,
    image_url: null,
    refresh_interval: 3600,
    last_checked: null,
    next_check_at: null,
    category: null,
    created_at: '2025-01-01T00:00:00.000Z',
    currency: 'USD',
    converted_price: 25,
    converted_currency: 'USD',
    ai_status: null,
    current_price: 25,
    member_price: null,
    original_price: null,
    price_drop_threshold: null,
    target_price: null,
    notify_back_in_stock: false,
    ai_verification_disabled: false,
    ai_extraction_disabled: false,
    sparkline: [],
    ...overrides,
  };
}

// One item whose two stores disagree: one has it and is being checked, the
// other does not and is paused.
const disagreeingInStock = listing({
  id: 1,
  name: 'Disagreeing Store With Stock',
  url: 'https://in-stock.test/product',
  stock_status: 'in_stock',
  checking_paused: false,
});
const disagreeingOutOfStock = listing({
  id: 2,
  name: 'Disagreeing Store Without Stock',
  url: 'https://out-of-stock.test/product',
  stock_status: 'out_of_stock',
  checking_paused: true,
});
// One item nowhere has, and nothing is still watching.
const nowhereListing = listing({
  id: 3,
  name: 'Nowhere Store',
  url: 'https://nowhere.test/product',
  stock_status: 'out_of_stock',
  checking_paused: true,
});

function item(id: number, name: string, listings: unknown[], anyInStock: boolean) {
  return {
    id,
    name,
    image_url: null,
    category: null,
    target_price: null,
    price_drop_threshold: null,
    notify_back_in_stock: false,
    listings,
    store_count: listings.length,
    best_price: 25,
    best_price_listing_ids: [],
    all_tied: false,
    best_price_currency: 'USD',
    price_spread: null,
    comparable_count: listings.length,
    excluded_count: 0,
    any_in_stock: anyInStock,
  };
}

const items = [
  item(10, 'Disagreeing Item', [disagreeingInStock, disagreeingOutOfStock], true),
  item(11, 'Nowhere Item', [nowhereListing], false),
];

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const responses: Record<string, unknown> = {
      '/api/auth/registration-status': { enabled: true },
      '/api/auth/oidc/config/public': { policy: 'local', oidc_enabled: false, oidc_provider_name: null },
      '/api/products': [disagreeingInStock, disagreeingOutOfStock, nowhereListing],
      '/api/products/items': items,
      '/api/profile': { ...authenticatedUser, categories: [] },
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

const tracking = (page: import('@playwright/test').Page) =>
  page.getByLabel('Filter by tracking status');
const stock = (page: import('@playwright/test').Page) =>
  page.getByLabel('Filter by stock status');

test('offers tracking and stock as two separately labelled filters', async ({ page }) => {
  await page.goto('/products');

  await expect(tracking(page)).toHaveValue('all');
  await expect(stock(page)).toHaveValue('all');
  // The old single control said only "All Status", which users read as stock.
  await expect(page.getByRole('option', { name: 'All Tracking' })).toHaveCount(1);
  await expect(page.getByRole('option', { name: 'All Stock' })).toHaveCount(1);
});

test('filters listings by tracking and by stock in the All stores view', async ({ page }) => {
  await page.goto('/products');

  await expect(page.getByText('Showing 3 stores')).toBeVisible();

  await stock(page).selectOption('out_of_stock');
  await expect(page.getByText('Showing 2 stores')).toBeVisible();
  await expect(page.getByText('Disagreeing Store With Stock')).toHaveCount(0);

  await tracking(page).selectOption('active');
  await expect(page.getByText('Showing 0 stores')).toBeVisible();
  await expect(page.getByText('No stores found')).toBeVisible();

  await stock(page).selectOption('in_stock');
  await expect(page.getByText('Showing 1 store')).toBeVisible();
  await expect(page.getByText('Disagreeing Store With Stock')).toBeVisible();
});

test('filters items by tracking and by stock in the By product view', async ({ page }) => {
  await page.goto('/products');
  await page.getByRole('button', { name: 'By product' }).click();

  // Items counted as items: two cards, not the three listings behind them.
  await expect(page.getByText('Showing 2 products')).toBeVisible();

  // An item one of whose three stores has it is in stock, not out of stock --
  // which is also what its own card says.
  await stock(page).selectOption('out_of_stock');
  await expect(page.getByText('Showing 1 product', { exact: true })).toBeVisible();
  await expect(page.getByText('Nowhere Item')).toBeVisible();
  await expect(page.getByText('Disagreeing Item')).toHaveCount(0);

  await stock(page).selectOption('in_stock');
  await expect(page.getByText('Disagreeing Item')).toBeVisible();
  await expect(page.getByText('Nowhere Item')).toHaveCount(0);

  // One live store keeps the item tracked; the all-paused item drops out.
  await stock(page).selectOption('all');
  await tracking(page).selectOption('active');
  await expect(page.getByText('Showing 1 product', { exact: true })).toBeVisible();
  await expect(page.getByText('Disagreeing Item')).toBeVisible();

  await tracking(page).selectOption('paused');
  await expect(page.getByText('Nowhere Item')).toBeVisible();
  await expect(page.getByText('Disagreeing Item')).toHaveCount(0);

  // Both filters at once, and a combination nothing can satisfy.
  await stock(page).selectOption('in_stock');
  await expect(page.getByText('Showing 0 products')).toBeVisible();
  await expect(page.getByText('No products match these filters')).toBeVisible();
});

test('remembers both filters across a reload', async ({ page }) => {
  await page.goto('/products');
  await tracking(page).selectOption('paused');
  await stock(page).selectOption('pre_order');

  await page.reload();

  await expect(tracking(page)).toHaveValue('paused');
  await expect(stock(page)).toHaveValue('pre_order');
});
