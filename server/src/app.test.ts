import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createExpressApp } from './app';
import {
  buildCategoryAncestryPath,
  buildProductCatalogFilter,
  collectDescendantCategoryIds,
  enrichProductPricing,
  getCatalogSortSpec,
} from './modules/products/productCatalogHelpers';

async function withTestServer(fn: (baseUrl: string) => Promise<void>) {
  const app = createExpressApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('API health reports database disconnected honestly when Atlas is not configured', async () => {
  await withTestServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/health`);
    const body = (await res.json()) as { ok: boolean; database: string; integrations: Record<string, boolean> };
    assert.equal(res.status, 503);
    assert.equal(body.ok, false);
    assert.equal(body.database, 'disconnected');
    assert.equal(typeof body.integrations.cloudinary, 'boolean');

    // When proxied behind container nginx (with X-Forwarded-Host), status maps to proxy-passthrough 424 JSON
    const prevNginxPort = process.env.NGINX_PORT;
    process.env.NGINX_PORT = '8080';
    try {
      const proxiedRes = await fetch(`${baseUrl}/api/health`, {
        headers: { 'X-Forwarded-Host': 'ais-dev-example.run.app' },
      });
      const proxiedBody = (await proxiedRes.json()) as { ok: boolean; database: string };
      assert.equal(proxiedRes.status, 424);
      assert.equal(proxiedRes.headers.get('x-origin-status'), '503');
      assert.equal(proxiedRes.headers.get('content-type')?.includes('application/json'), true);
      assert.equal(proxiedBody.ok, false);
      assert.equal(proxiedBody.database, 'disconnected');
    } finally {
      if (prevNginxPort === undefined) {
        delete process.env.NGINX_PORT;
      } else {
        process.env.NGINX_PORT = prevNginxPort;
      }
    }
  });
});

test('Unknown /api and /api/* routes plus malformed JSON return structured JSON rather than HTML', async () => {
  await withTestServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/does-not-exist`);
    const body = (await res.json()) as { ok: boolean; code: string };
    assert.equal(res.status, 404);
    assert.equal(res.headers.get('content-type')?.includes('application/json'), true);
    assert.equal(body.ok, false);
    assert.equal(body.code, 'API_NOT_FOUND');

    const rootApiRes = await fetch(`${baseUrl}/api`);
    const rootBody = (await rootApiRes.json()) as { ok: boolean; code: string };
    assert.equal(rootApiRes.status, 404);
    assert.equal(rootApiRes.headers.get('content-type')?.includes('application/json'), true);
    assert.equal(rootBody.ok, false);
    assert.equal(rootBody.code, 'API_NOT_FOUND');

    const badJsonRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email":',
    });
    const badJsonBody = (await badJsonRes.json()) as { ok: boolean; code: string };
    assert.equal(badJsonRes.status, 400);
    assert.equal(badJsonRes.headers.get('content-type')?.includes('application/json'), true);
    assert.equal(badJsonBody.ok, false);
    assert.equal(badJsonBody.code, 'INVALID_JSON_BODY');
  });
});

test('Catalog and storefront API routes return JSON with no-store Cache-Control and never hijack SPA /pages/:slug', async () => {
  await withTestServer(async (baseUrl) => {
    const prodRes = await fetch(`${baseUrl}/api/products`);
    assert.equal(prodRes.status, 503);
    assert.ok(prodRes.headers.get('content-type')?.includes('application/json'));
    assert.ok(prodRes.headers.get('cache-control')?.includes('no-store'));

    const homeRes = await fetch(`${baseUrl}/api/storefront/homepage`);
    assert.equal(homeRes.status, 503);
    assert.ok(homeRes.headers.get('content-type')?.includes('application/json'));
    assert.ok(homeRes.headers.get('cache-control')?.includes('no-store'));

    // /pages/about-us must NOT be intercepted by Express JSON storefrontRoutes at root
    const spaPageRes = await fetch(`${baseUrl}/pages/about-us`);
    assert.equal(spaPageRes.status, 404);

    // /api/storefront/pages/about-us hits the API route
    const apiPageRes = await fetch(`${baseUrl}/api/storefront/pages/about-us`);
    assert.equal(apiPageRes.status, 503);
    assert.ok(apiPageRes.headers.get('content-type')?.includes('application/json'));
  });
});

test('Protected checkout and admin endpoints fail closed when DB/auth is unavailable', async () => {
  await withTestServer(async (baseUrl) => {
    const checkoutRes = await fetch(`${baseUrl}/api/orders/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.ok(checkoutRes.status === 401 || checkoutRes.status === 503);

    const adminRes = await fetch(`${baseUrl}/api/admin/overview`);
    assert.ok(adminRes.status === 401 || adminRes.status === 503);
  });
});

test('SEO robots.txt and sitemap.xml return expected content types', async () => {
  await withTestServer(async (baseUrl) => {
    const robots = await fetch(`${baseUrl}/robots.txt`);
    const robotsText = await robots.text();
    assert.equal(robots.status, 200);
    assert.ok(robotsText.includes('Disallow: /admin'));
    assert.ok(robotsText.includes('Sitemap:'));

    const sitemap = await fetch(`${baseUrl}/sitemap.xml`);
    const xml = await sitemap.text();
    assert.equal(sitemap.status, 200);
    assert.ok(xml.includes('<urlset'));
  });
});

test('Product catalog helpers handle category ancestry, variant stock, discount filters, and sorting', () => {
  const categories = [
    { _id: 'c1', slug: 'electronics', parentId: null },
    { _id: 'c2', slug: 'mobiles-tablets', parentId: 'c1' },
    { _id: 'c3', slug: 'android-phones', parentId: 'c2' },
  ];

  const descendants = collectDescendantCategoryIds('c1', categories);
  assert.deepEqual(descendants, ['c1', 'c2', 'c3']);

  const path = buildCategoryAncestryPath({
    categoryId: 'c2',
    subCategoryId: 'c3',
    allCategories: categories,
  });
  assert.ok(path.includes('electronics'));
  assert.ok(path.includes('mobiles-tablets'));
  assert.ok(path.includes('android-phones'));

  const filter = buildProductCatalogFilter({
    categoryIds: ['c1', 'c2'],
    inStockOnly: true,
    discountOnly: true,
    section: 'featured',
  });
  assert.equal(filter.status, 'published');
  assert.ok(Array.isArray(filter.$and) && filter.$and.length >= 4);

  const enriched = enrichProductPricing({
    _id: 'p1',
    basePrice: 1000,
    salePrice: 800,
    stockOnHand: 0,
    reservedStock: 0,
    hasVariants: true,
    variants: [
      { stockOnHand: 5, reservedStock: 2, isActive: true },
      { stockOnHand: 10, reservedStock: 0, isActive: false },
    ],
    categoryId: { _id: 'c2', name: 'Mobiles', slug: 'mobiles-tablets' },
  });
  assert.equal(enriched.id, 'p1');
  assert.equal(enriched.currentPrice, 800);
  assert.equal(enriched.originalPrice, 1000);
  assert.equal(enriched.discountPercent, 20);
  assert.equal(enriched.availableStock, 3);

  assert.deepEqual(getCatalogSortSpec('price_asc'), { _effectivePrice: 1, createdAt: -1 });
  assert.deepEqual(getCatalogSortSpec('newest'), { createdAt: -1 });
});
