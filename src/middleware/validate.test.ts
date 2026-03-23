/**
 * @file middleware/validate.test.ts
 * @description Unit tests for the validate() middleware factory and
 *              validateObject() core validator.
 *
 * Coverage targets:
 *  - All FieldType branches (string, number, boolean, object, array)
 *  - required / optional field handling
 *  - min / max / pattern / enum constraints
 *  - strict mode (unknown field rejection)
 *  - Malformed body shapes (array body, primitive body, missing body)
 *  - Middleware integration: next() called on success, 400 returned on failure
 *
 * @security
 *  Threat scenarios validated here:
 *  - Mass-assignment: extra fields rejected in strict mode
 *  - Oversized strings: max constraint enforced
 *  - Type confusion: wrong-type values produce clear errors, not crashes
 *  - Prototype pollution probe: __proto__ key treated as unknown field
 *  - Null / undefined body: treated as empty object, not a crash
 */

import { Request, Response, NextFunction } from 'express';
import {
  validate,
  validateObject,
  Schema,
  ValidationError,
} from './validate';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal mock Express Request. */
function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {},
    query: {},
    ...overrides,
  } as unknown as Request;
}

/** Capture res.status().json() calls. */
function mockRes(): { res: Response; statusCode: () => number; json: () => unknown } {
  let code = 200;
  let payload: unknown;
  const res = {
    status(c: number) {
      code = c;
      return res;
    },
    json(p: unknown) {
      payload = p;
      return res;
    },
  } as unknown as Response;
  return { res, statusCode: () => code, json: () => payload };
}

const noopNext: NextFunction = () => undefined;

// ---------------------------------------------------------------------------
// validateObject() — unit tests
// ---------------------------------------------------------------------------

describe('validateObject()', () => {
  const schema: Schema = {
    name: { type: 'string', required: true, min: 2, max: 50 },
    age: { type: 'number', required: false, min: 0, max: 150 },
    active: { type: 'boolean', required: false },
    tags: { type: 'array', required: false },
    meta: { type: 'object', required: false },
    role: { type: 'string', required: false, enum: ['admin', 'user'] },
    code: { type: 'string', required: false, pattern: /^[A-Z]{3}$/ },
  };

  // ── Required fields ───────────────────────────────────────────────────────

  it('returns no errors for a fully valid object', () => {
    const errors = validateObject({ name: 'Alice' }, schema, false, 'body');
    expect(errors).toHaveLength(0);
  });

  it('errors when a required field is missing', () => {
    const errors = validateObject({}, schema, false, 'body');
    expect(errors.some((e) => e.field === 'body.name')).toBe(true);
  });

  it('errors when a required field is null', () => {
    const errors = validateObject({ name: null }, schema, false, 'body');
    expect(errors.some((e) => e.field === 'body.name')).toBe(true);
  });

  it('does not error when an optional field is absent', () => {
    const errors = validateObject({ name: 'Bob' }, schema, false, 'body');
    const optionalErrors = errors.filter((e) =>
      ['body.age', 'body.active', 'body.tags'].includes(e.field),
    );
    expect(optionalErrors).toHaveLength(0);
  });

  // ── Type checks ───────────────────────────────────────────────────────────

  it('errors when string field receives a number', () => {
    const errors = validateObject({ name: 42 }, schema, false, 'body');
    expect(errors[0].message).toMatch(/Expected type string/);
  });

  it('errors when number field receives a string', () => {
    const errors = validateObject({ name: 'Alice', age: 'old' }, schema, false, 'body');
    expect(errors.some((e) => e.field === 'body.age')).toBe(true);
  });

  it('correctly identifies arrays (not "object")', () => {
    const errors = validateObject({ name: 'Alice', meta: [1, 2] }, schema, false, 'body');
    expect(errors.some((e) => e.field === 'body.meta')).toBe(true);
  });

  it('accepts a real array for an array-typed field', () => {
    const errors = validateObject({ name: 'Alice', tags: ['a', 'b'] }, schema, false, 'body');
    expect(errors.filter((e) => e.field === 'body.tags')).toHaveLength(0);
  });

  it('accepts a plain object for an object-typed field', () => {
    const errors = validateObject({ name: 'Alice', meta: { k: 1 } }, schema, false, 'body');
    expect(errors.filter((e) => e.field === 'body.meta')).toHaveLength(0);
  });

  it('accepts a boolean for a boolean-typed field', () => {
    const errors = validateObject({ name: 'Alice', active: false }, schema, false, 'body');
    expect(errors.filter((e) => e.field === 'body.active')).toHaveLength(0);
  });

  // ── String constraints ────────────────────────────────────────────────────

  it('errors when string is shorter than min', () => {
    const errors = validateObject({ name: 'A' }, schema, false, 'body');
    expect(errors[0].message).toMatch(/at least 2/);
  });

  it('errors when string exceeds max', () => {
    const errors = validateObject({ name: 'A'.repeat(51) }, schema, false, 'body');
    expect(errors[0].message).toMatch(/at most 50/);
  });

  it('accepts a string exactly at min length', () => {
    const errors = validateObject({ name: 'Al' }, schema, false, 'body');
    expect(errors).toHaveLength(0);
  });

  it('accepts a string exactly at max length', () => {
    const errors = validateObject({ name: 'A'.repeat(50) }, schema, false, 'body');
    expect(errors).toHaveLength(0);
  });

  // ── Number constraints ────────────────────────────────────────────────────

  it('errors when number is below min', () => {
    const errors = validateObject({ name: 'Alice', age: -1 }, schema, false, 'body');
    expect(errors.some((e) => e.field === 'body.age')).toBe(true);
  });

  it('errors when number exceeds max', () => {
    const errors = validateObject({ name: 'Alice', age: 200 }, schema, false, 'body');
    expect(errors.some((e) => e.field === 'body.age')).toBe(true);
  });

  it('accepts a number at the boundary values', () => {
    const e1 = validateObject({ name: 'Alice', age: 0 }, schema, false, 'body');
    const e2 = validateObject({ name: 'Alice', age: 150 }, schema, false, 'body');
    expect(e1.filter((e) => e.field === 'body.age')).toHaveLength(0);
    expect(e2.filter((e) => e.field === 'body.age')).toHaveLength(0);
  });

  // ── Pattern ───────────────────────────────────────────────────────────────

  it('errors when string does not match pattern', () => {
    const errors = validateObject({ name: 'Alice', code: 'abc' }, schema, false, 'body');
    expect(errors.some((e) => e.field === 'body.code')).toBe(true);
  });

  it('accepts a string matching the pattern', () => {
    const errors = validateObject({ name: 'Alice', code: 'ABC' }, schema, false, 'body');
    expect(errors.filter((e) => e.field === 'body.code')).toHaveLength(0);
  });

  // ── Enum ──────────────────────────────────────────────────────────────────

  it('errors when value is not in enum', () => {
    const errors = validateObject({ name: 'Alice', role: 'superuser' }, schema, false, 'body');
    expect(errors.some((e) => e.field === 'body.role')).toBe(true);
  });

  it('accepts a valid enum value', () => {
    const errors = validateObject({ name: 'Alice', role: 'admin' }, schema, false, 'body');
    expect(errors.filter((e) => e.field === 'body.role')).toHaveLength(0);
  });

  // ── Strict mode ───────────────────────────────────────────────────────────

  it('rejects unknown fields in strict mode', () => {
    const errors = validateObject({ name: 'Alice', unknown: 'x' }, schema, true, 'body');
    expect(errors.some((e) => e.field === 'body.unknown')).toBe(true);
  });

  it('allows unknown fields when strict=false', () => {
    const errors = validateObject({ name: 'Alice', extra: 'x' }, schema, false, 'body');
    expect(errors.filter((e) => e.field === 'body.extra')).toHaveLength(0);
  });

  // ── Security: prototype pollution probe ──────────────────────────────────

  it('treats __proto__ as an unknown field in strict mode', () => {
    const data: Record<string, unknown> = { name: 'Alice' };
    data['__proto__'] = { polluted: true };
    const errors = validateObject(data, schema, true, 'body');
    expect(errors.some((e) => e.field === 'body.__proto__')).toBe(true);
  });

  it('treats constructor as an unknown field in strict mode', () => {
    const data: Record<string, unknown> = { name: 'Alice', constructor: 'evil' };
    const errors = validateObject(data, schema, true, 'body');
    expect(errors.some((e) => e.field === 'body.constructor')).toBe(true);
  });

  // ── Error shape ───────────────────────────────────────────────────────────

  it('returns errors with field and message properties', () => {
    const errors = validateObject({}, schema, false, 'body');
    errors.forEach((e: ValidationError) => {
      expect(e).toHaveProperty('field');
      expect(e).toHaveProperty('message');
      expect(typeof e.field).toBe('string');
      expect(typeof e.message).toBe('string');
    });
  });

  it('prefixes field names with the supplied prefix', () => {
    const errors = validateObject({}, schema, false, 'params');
    expect(errors[0].field).toMatch(/^params\./);
  });
});

// ---------------------------------------------------------------------------
// validate() middleware — integration with mock req/res
// ---------------------------------------------------------------------------

describe('validate() middleware', () => {
  const bodySchema: Schema = {
    title: { type: 'string', required: true, min: 1, max: 100 },
    amount: { type: 'number', required: true, min: 1 },
  };

  // ── Happy path ────────────────────────────────────────────────────────────

  it('calls next() when body is valid', () => {
    let called = false;
    const next: NextFunction = () => { called = true; };
    const req = mockReq({ body: { title: 'Test', amount: 50 } });
    const { res } = mockRes();
    validate({ body: bodySchema })(req, res, next);
    expect(called).toBe(true);
  });

  it('does not call res.status() when body is valid', () => {
    const { res, statusCode } = mockRes();
    const req = mockReq({ body: { title: 'Test', amount: 50 } });
    validate({ body: bodySchema })(req, res, noopNext);
    expect(statusCode()).toBe(200); // untouched
  });

  // ── Validation failures ───────────────────────────────────────────────────

  it('returns 400 when a required body field is missing', () => {
    const { res, statusCode } = mockRes();
    validate({ body: bodySchema })(mockReq({ body: {} }), res, noopNext);
    expect(statusCode()).toBe(400);
  });

  it('returns structured error JSON on failure', () => {
    const { res, json } = mockRes();
    validate({ body: bodySchema })(mockReq({ body: {} }), res, noopNext);
    const payload = json() as { error: string; details: ValidationError[] };
    expect(payload.error).toBe('Validation failed');
    expect(Array.isArray(payload.details)).toBe(true);
    expect(payload.details.length).toBeGreaterThan(0);
  });

  it('does not call next() when validation fails', () => {
    let called = false;
    const next: NextFunction = () => { called = true; };
    const { res } = mockRes();
    validate({ body: bodySchema })(mockReq({ body: {} }), res, next);
    expect(called).toBe(false);
  });

  // ── Malformed body shapes ─────────────────────────────────────────────────

  it('treats an array body as empty object (does not crash)', () => {
    const { res, statusCode } = mockRes();
    validate({ body: bodySchema })(mockReq({ body: [] }), res, noopNext);
    expect(statusCode()).toBe(400); // required fields missing
  });

  it('treats a string body as empty object (does not crash)', () => {
    const { res, statusCode } = mockRes();
    validate({ body: bodySchema })(mockReq({ body: 'malicious' }), res, noopNext);
    expect(statusCode()).toBe(400);
  });

  it('treats null body as empty object (does not crash)', () => {
    const { res, statusCode } = mockRes();
    validate({ body: bodySchema })(mockReq({ body: null }), res, noopNext);
    expect(statusCode()).toBe(400);
  });

  it('treats undefined body as empty object (does not crash)', () => {
    const { res, statusCode } = mockRes();
    validate({ body: bodySchema })(mockReq({ body: undefined }), res, noopNext);
    expect(statusCode()).toBe(400);
  });

  // ── Strict mode (default) ─────────────────────────────────────────────────

  it('rejects unknown fields by default (strict=true)', () => {
    const { res, statusCode } = mockRes();
    const req = mockReq({ body: { title: 'T', amount: 10, extra: 'x' } });
    validate({ body: bodySchema })(req, res, noopNext);
    expect(statusCode()).toBe(400);
  });

  it('allows unknown fields when strict=false', () => {
    let called = false;
    const next: NextFunction = () => { called = true; };
    const req = mockReq({ body: { title: 'T', amount: 10, extra: 'x' } });
    const { res } = mockRes();
    validate({ body: bodySchema, strict: false })(req, res, next);
    expect(called).toBe(true);
  });

  // ── Params validation ─────────────────────────────────────────────────────

  it('validates req.params when params schema is provided', () => {
    const { res, statusCode } = mockRes();
    const paramsSchema: Schema = { id: { type: 'string', required: true } };
    validate({ params: paramsSchema })(mockReq({ params: {} as never }), res, noopNext);
    expect(statusCode()).toBe(400);
  });

  it('calls next() when params are valid', () => {
    let called = false;
    const next: NextFunction = () => { called = true; };
    const paramsSchema: Schema = { id: { type: 'string', required: true } };
    const req = mockReq({ params: { id: 'abc123' } as never });
    const { res } = mockRes();
    validate({ params: paramsSchema })(req, res, next);
    expect(called).toBe(true);
  });

  // ── Query validation ──────────────────────────────────────────────────────

  it('validates req.query when query schema is provided', () => {
    const { res, statusCode } = mockRes();
    const querySchema: Schema = {
      status: { type: 'string', required: false, enum: ['open', 'closed'] },
    };
    const req = mockReq({ query: { status: 'invalid' } as never });
    validate({ query: querySchema, strict: false })(req, res, noopNext);
    expect(statusCode()).toBe(400);
  });

  it('calls next() when query is valid', () => {
    let called = false;
    const next: NextFunction = () => { called = true; };
    const querySchema: Schema = {
      status: { type: 'string', required: false, enum: ['open', 'closed'] },
    };
    const req = mockReq({ query: { status: 'open' } as never });
    const { res } = mockRes();
    validate({ query: querySchema, strict: false })(req, res, next);
    expect(called).toBe(true);
  });

  // ── Combined body + params + query ────────────────────────────────────────

  it('accumulates errors from body, params, and query together', () => {
    const { res, json } = mockRes();
    const req = mockReq({
      body: {},
      params: {} as never,
      query: {} as never,
    });
    validate({
      body: { x: { type: 'string', required: true } },
      params: { id: { type: 'string', required: true } },
      query: { q: { type: 'string', required: true } },
    })(req, res, noopNext);
    const payload = json() as { details: ValidationError[] };
    expect(payload.details.length).toBeGreaterThanOrEqual(3);
  });

  // ── No schemas provided ───────────────────────────────────────────────────

  it('calls next() when no schemas are provided', () => {
    let called = false;
    const next: NextFunction = () => { called = true; };
    validate({})(mockReq(), mockRes().res, next);
    expect(called).toBe(true);
  });
});
