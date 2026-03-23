/**
 * @file routes/contracts.test.ts
 * @description Integration tests for the contracts router.
 *
 * Tests cover:
 *  - GET /  — list contracts (happy path + invalid query params)
 *  - POST / — create contract (happy path, missing fields, wrong types,
 *             oversized values, unknown fields, malformed JSON body)
 *
 * @security
 *  - Verifies 400 is returned (not 500) for all malformed inputs.
 *  - Verifies error responses never echo raw user input verbatim.
 *  - Verifies unknown fields are rejected (mass-assignment prevention).
 */

import express from 'express';
import http from 'http';
import { contractsRouter } from './contracts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SimpleResponse {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

function request(
  server: http.Server,
  method: string,
  path: string,
  body?: unknown,
): Promise<SimpleResponse> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as { port: number };
    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const options: http.RequestOptions = {
      hostname: '127.0.0.1',
      port: addr.port,
      path,
      method,
      headers: payload
        ? {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          }
        : {},
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () =>
        resolve({ statusCode: res.statusCode ?? 0, headers: res.headers, body: data }),
      );
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('contractsRouter', () => {
  let server: http.Server;

  beforeAll(() => {
    return new Promise<void>((resolve) => {
      const app = express();
      app.use(express.json());
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      app.use('/', contractsRouter);
      server = app.listen(0, '127.0.0.1', resolve);
    });
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  // ── GET / ─────────────────────────────────────────────────────────────────

  describe('GET /', () => {
    it('returns 200 with contracts array', async () => {
      const res = await request(server, 'GET', '/');
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ contracts: [] });
    });

    it('accepts valid status query param', async () => {
      const res = await request(server, 'GET', '/?status=open');
      expect(res.statusCode).toBe(200);
    });

    it('returns 400 for invalid status query param', async () => {
      const res = await request(server, 'GET', '/?status=invalid');
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for non-numeric limit', async () => {
      const res = await request(server, 'GET', '/?limit=abc');
      expect(res.statusCode).toBe(400);
    });

    it('accepts valid numeric limit', async () => {
      const res = await request(server, 'GET', '/?limit=10');
      expect(res.statusCode).toBe(200);
    });
  });

  // ── POST / — happy path ───────────────────────────────────────────────────

  describe('POST / — valid payload', () => {
    const validBody = {
      title: 'Build a dApp',
      clientId: 'client-001',
      freelancerId: 'freelancer-001',
      amount: 500,
    };

    it('returns 201 for a valid payload', async () => {
      const res = await request(server, 'POST', '/', validBody);
      expect(res.statusCode).toBe(201);
    });

    it('returns the created contract in the response', async () => {
      const res = await request(server, 'POST', '/', validBody);
      const json = JSON.parse(res.body) as { contract: { title: string } };
      expect(json).toHaveProperty('contract');
      expect(json.contract.title).toBe(validBody.title);
    });

    it('accepts payload with optional description', async () => {
      const res = await request(server, 'POST', '/', {
        ...validBody,
        description: 'Some details here',
      });
      expect(res.statusCode).toBe(201);
    });

    it('responds with application/json', async () => {
      const res = await request(server, 'POST', '/', validBody);
      expect(res.headers['content-type']).toMatch(/application\/json/);
    });
  });

  // ── POST / — missing required fields ─────────────────────────────────────

  describe('POST / — missing fields', () => {
    it('returns 400 when body is empty', async () => {
      const res = await request(server, 'POST', '/', {});
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when title is missing', async () => {
      const res = await request(server, 'POST', '/', {
        clientId: 'c1',
        freelancerId: 'f1',
        amount: 100,
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when clientId is missing', async () => {
      const res = await request(server, 'POST', '/', {
        title: 'T',
        freelancerId: 'f1',
        amount: 100,
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when freelancerId is missing', async () => {
      const res = await request(server, 'POST', '/', {
        title: 'T',
        clientId: 'c1',
        amount: 100,
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when amount is missing', async () => {
      const res = await request(server, 'POST', '/', {
        title: 'T',
        clientId: 'c1',
        freelancerId: 'f1',
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns structured error details', async () => {
      const res = await request(server, 'POST', '/', {});
      const json = JSON.parse(res.body) as { error: string; details: unknown[] };
      expect(json.error).toBe('Validation failed');
      expect(Array.isArray(json.details)).toBe(true);
      expect(json.details.length).toBeGreaterThan(0);
    });
  });

  // ── POST / — type errors ──────────────────────────────────────────────────

  describe('POST / — wrong types', () => {
    const base = { title: 'T', clientId: 'c1', freelancerId: 'f1', amount: 100 };

    it('returns 400 when amount is a string', async () => {
      const res = await request(server, 'POST', '/', { ...base, amount: '100' });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when title is a number', async () => {
      const res = await request(server, 'POST', '/', { ...base, title: 42 });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when clientId is an object', async () => {
      const res = await request(server, 'POST', '/', { ...base, clientId: {} });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when amount is an array', async () => {
      const res = await request(server, 'POST', '/', { ...base, amount: [100] });
      expect(res.statusCode).toBe(400);
    });
  });

  // ── POST / — boundary / constraint violations ─────────────────────────────

  describe('POST / — constraint violations', () => {
    const base = { title: 'T', clientId: 'c1', freelancerId: 'f1', amount: 100 };

    it('returns 400 for empty title', async () => {
      const res = await request(server, 'POST', '/', { ...base, title: '' });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for title > 120 chars', async () => {
      const res = await request(server, 'POST', '/', { ...base, title: 'A'.repeat(121) });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for zero amount', async () => {
      const res = await request(server, 'POST', '/', { ...base, amount: 0 });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for negative amount', async () => {
      const res = await request(server, 'POST', '/', { ...base, amount: -1 });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for amount above 1,000,000', async () => {
      const res = await request(server, 'POST', '/', { ...base, amount: 1_000_001 });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for description > 500 chars', async () => {
      const res = await request(server, 'POST', '/', {
        ...base,
        description: 'x'.repeat(501),
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // ── POST / — security: mass-assignment / unknown fields ───────────────────

  describe('POST / — unknown fields (strict mode)', () => {
    const base = { title: 'T', clientId: 'c1', freelancerId: 'f1', amount: 100 };

    it('returns 400 when unknown field is present', async () => {
      const res = await request(server, 'POST', '/', { ...base, isAdmin: true });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for __proto__ field', async () => {
      // Send raw JSON to bypass JS object literal restrictions
      const raw = `{"title":"T","clientId":"c1","freelancerId":"f1","amount":100,"__proto__":{"polluted":true}}`;
      const addr = server.address() as { port: number };
      const res = await new Promise<SimpleResponse>((resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: addr.port,
            path: '/',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(raw),
            },
          },
          (r) => {
            let data = '';
            r.on('data', (c) => (data += c));
            r.on('end', () =>
              resolve({ statusCode: r.statusCode ?? 0, headers: r.headers, body: data }),
            );
          },
        );
        req.on('error', reject);
        req.write(raw);
        req.end();
      });
      expect(res.statusCode).toBe(400);
    });

    it('error response does not echo raw user input verbatim', async () => {
      const res = await request(server, 'POST', '/', { ...base, injected: '<script>alert(1)</script>' });
      expect(res.body).not.toContain('<script>');
    });
  });

  // ── POST / — malformed body ───────────────────────────────────────────────

  describe('POST / — malformed body', () => {
    it('returns 400 for an array body', async () => {
      const res = await request(server, 'POST', '/', [1, 2, 3]);
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when no body is sent', async () => {
      const res = await request(server, 'POST', '/');
      expect(res.statusCode).toBe(400);
    });
  });
});
