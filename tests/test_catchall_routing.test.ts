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
      return candidate.map((s) => String(s).trim()).filter(Boolean);
    }
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.split("/").map((s) => s.trim()).filter(Boolean);
    }
  }

  if (req.url && typeof req.url === "string") {
    const pathname = req.url.split("?")[0] || "";
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
