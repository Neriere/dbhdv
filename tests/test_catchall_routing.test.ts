import { test } from 'node:test';
import assert from 'node:assert';

function extractPathSegments(req: any, basePath: string): string[] {
  const candidates = [
    req.query?.["...path"],
    req.query?.path,
    req.query?.["[...path]"],
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      const segs = candidate
        .map((s) => decodeURIComponent(String(s)).trim())
        .filter(Boolean);
      if (segs[0] === basePath) return segs.slice(1);
      return segs;
    }
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      const segs = decodeURIComponent(candidate)
        .split("/")
        .map((s) => s.trim())
        .filter(Boolean);
      if (segs[0] === basePath) return segs.slice(1);
      return segs;
    }
  }

  if (req.url && typeof req.url === "string") {
    const pathname = decodeURIComponent(req.url.split("?")[0] || "");
    const segments = pathname.split("/").filter(Boolean);
    const idx = segments.indexOf(basePath);
    if (idx !== -1) {
      return segments.slice(idx + 1);
    }
    if (segments[0] === "api") {
      return segments.slice(1);
    }
    return segments;
  }

  return [];
}

test('Vercel catch-all path extraction for bootstrap with ...path in query', () => {
  const req = {
    url: '/api/local-db/bootstrap?profileId=1',
    query: { profileId: '1', '...path': 'bootstrap' }
  };
  const segments = extractPathSegments(req, 'local-db');
  assert.deepStrictEqual(segments, ['bootstrap']);
});

test('Vercel rewrite path extraction for items/:id (e.g. items/757)', () => {
  const req = {
    url: '/api/local-db?path=items/757',
    query: { path: 'items/757' }
  };
  const segments = extractPathSegments(req, 'local-db');
  assert.deepStrictEqual(segments, ['items', '757']);
});

test('Vercel rewrite path extraction for sales-volume/bulk', () => {
  const req = {
    url: '/api/local-db?path=sales-volume/bulk',
    query: { path: 'sales-volume/bulk' }
  };
  const segments = extractPathSegments(req, 'local-db');
  assert.deepStrictEqual(segments, ['sales-volume', 'bulk']);
});

test('Vercel rewrite path extraction for URL-encoded path segments', () => {
  const req = {
    url: '/api/local-db?path=items%2F2436',
    query: { path: 'items%2F2436' }
  };
  const segments = extractPathSegments(req, 'local-db');
  assert.deepStrictEqual(segments, ['items', '2436']);
});

test('Vercel rewrite path extraction when basePath is prepended', () => {
  const req = {
    url: '/api/local-db?path=local-db/items/757',
    query: { path: 'local-db/items/757' }
  };
  const segments = extractPathSegments(req, 'local-db');
  assert.deepStrictEqual(segments, ['items', '757']);
});

test('Vercel catch-all path extraction for price history item with ...path in query', () => {
  const req = {
    url: '/api/local-db/price-history/item/11334?profileId=1',
    query: { profileId: '1', '...path': 'price-history/item/11334' }
  };
  const segments = extractPathSegments(req, 'local-db');
  assert.deepStrictEqual(segments, ['price-history', 'item', '11334']);
});

test('Vercel catch-all path extraction for price history item with path array in query', () => {
  const req = {
    url: '/api/local-db/price-history/item/11334?profileId=1',
    query: { profileId: '1', path: ['price-history', 'item', '11334'] }
  };
  const segments = extractPathSegments(req, 'local-db');
  assert.deepStrictEqual(segments, ['price-history', 'item', '11334']);
});

test('Fallback URL parsing when query parameters for path are missing', () => {
  const req = {
    url: '/api/local-db/price-history/item/11334?profileId=1',
    query: { profileId: '1' }
  };
  const segments = extractPathSegments(req, 'local-db');
  assert.deepStrictEqual(segments, ['price-history', 'item', '11334']);
});

test('Fallback URL parsing for dofocus server coefficients', () => {
  const req = {
    url: '/api/dofocus/coefficients/Draconiros',
    query: {}
  };
  const segments = extractPathSegments(req, 'dofocus');
  assert.deepStrictEqual(segments, ['coefficients', 'Draconiros']);
});
