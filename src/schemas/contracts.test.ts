/**
 * @file schemas/contracts.test.ts
 * @description Unit tests for contract validation schemas.
 *
 * Validates that the schema definitions themselves enforce the correct
 * constraints — independent of the middleware wiring.
 *
 * @security
 *  - Verifies amount lower-bound prevents zero/negative escrow values.
 *  - Verifies status enum prevents arbitrary string injection.
 *  - Verifies field length caps prevent oversized payload attacks.
 */

import { validateObject } from '../middleware/validate';
import { createContractSchema, listContractsQuerySchema } from './contracts';

// ---------------------------------------------------------------------------
// createContractSchema
// ---------------------------------------------------------------------------

describe('createContractSchema', () => {
  const valid = {
    title: 'Build a dApp',
    clientId: 'client-abc',
    freelancerId: 'freelancer-xyz',
    amount: 500,
  };

  it('accepts a fully valid payload', () => {
    expect(validateObject(valid, createContractSchema, true, 'body')).toHaveLength(0);
  });

  it('accepts payload with optional description', () => {
    const errors = validateObject(
      { ...valid, description: 'Some details' },
      createContractSchema,
      true,
      'body',
    );
    expect(errors).toHaveLength(0);
  });

  // ── title ─────────────────────────────────────────────────────────────────

  it('rejects missing title', () => {
    const { title: _t, ...rest } = valid;
    void _t;
    const errors = validateObject(rest, createContractSchema, true, 'body');
    expect(errors.some((e) => e.field === 'body.title')).toBe(true);
  });

  it('rejects empty title', () => {
    const errors = validateObject({ ...valid, title: '' }, createContractSchema, true, 'body');
    expect(errors.some((e) => e.field === 'body.title')).toBe(true);
  });

  it('rejects title longer than 120 chars', () => {
    const errors = validateObject(
      { ...valid, title: 'A'.repeat(121) },
      createContractSchema,
      true,
      'body',
    );
    expect(errors.some((e) => e.field === 'body.title')).toBe(true);
  });

  it('accepts title exactly 120 chars', () => {
    const errors = validateObject(
      { ...valid, title: 'A'.repeat(120) },
      createContractSchema,
      true,
      'body',
    );
    expect(errors.filter((e) => e.field === 'body.title')).toHaveLength(0);
  });

  // ── clientId ──────────────────────────────────────────────────────────────

  it('rejects missing clientId', () => {
    const { clientId: _c, ...rest } = valid;
    void _c;
    const errors = validateObject(rest, createContractSchema, true, 'body');
    expect(errors.some((e) => e.field === 'body.clientId')).toBe(true);
  });

  it('rejects clientId longer than 64 chars', () => {
    const errors = validateObject(
      { ...valid, clientId: 'x'.repeat(65) },
      createContractSchema,
      true,
      'body',
    );
    expect(errors.some((e) => e.field === 'body.clientId')).toBe(true);
  });

  // ── freelancerId ──────────────────────────────────────────────────────────

  it('rejects missing freelancerId', () => {
    const { freelancerId: _f, ...rest } = valid;
    void _f;
    const errors = validateObject(rest, createContractSchema, true, 'body');
    expect(errors.some((e) => e.field === 'body.freelancerId')).toBe(true);
  });

  it('rejects freelancerId longer than 64 chars', () => {
    const errors = validateObject(
      { ...valid, freelancerId: 'x'.repeat(65) },
      createContractSchema,
      true,
      'body',
    );
    expect(errors.some((e) => e.field === 'body.freelancerId')).toBe(true);
  });

  // ── amount ────────────────────────────────────────────────────────────────

  it('rejects missing amount', () => {
    const { amount: _a, ...rest } = valid;
    void _a;
    const errors = validateObject(rest, createContractSchema, true, 'body');
    expect(errors.some((e) => e.field === 'body.amount')).toBe(true);
  });

  it('rejects zero amount (security: no zero-value escrow)', () => {
    const errors = validateObject({ ...valid, amount: 0 }, createContractSchema, true, 'body');
    expect(errors.some((e) => e.field === 'body.amount')).toBe(true);
  });

  it('rejects negative amount (security: no negative escrow)', () => {
    const errors = validateObject({ ...valid, amount: -100 }, createContractSchema, true, 'body');
    expect(errors.some((e) => e.field === 'body.amount')).toBe(true);
  });

  it('rejects amount above 1,000,000', () => {
    const errors = validateObject(
      { ...valid, amount: 1_000_001 },
      createContractSchema,
      true,
      'body',
    );
    expect(errors.some((e) => e.field === 'body.amount')).toBe(true);
  });

  it('accepts amount at the upper boundary (1,000,000)', () => {
    const errors = validateObject(
      { ...valid, amount: 1_000_000 },
      createContractSchema,
      true,
      'body',
    );
    expect(errors.filter((e) => e.field === 'body.amount')).toHaveLength(0);
  });

  it('rejects amount as a string (type confusion)', () => {
    const errors = validateObject(
      { ...valid, amount: '500' },
      createContractSchema,
      true,
      'body',
    );
    expect(errors.some((e) => e.field === 'body.amount')).toBe(true);
  });

  // ── description (optional) ────────────────────────────────────────────────

  it('rejects description longer than 500 chars', () => {
    const errors = validateObject(
      { ...valid, description: 'x'.repeat(501) },
      createContractSchema,
      true,
      'body',
    );
    expect(errors.some((e) => e.field === 'body.description')).toBe(true);
  });

  it('accepts description exactly 500 chars', () => {
    const errors = validateObject(
      { ...valid, description: 'x'.repeat(500) },
      createContractSchema,
      true,
      'body',
    );
    expect(errors.filter((e) => e.field === 'body.description')).toHaveLength(0);
  });

  // ── Strict mode: unknown fields ───────────────────────────────────────────

  it('rejects unknown fields in strict mode', () => {
    const errors = validateObject(
      { ...valid, isAdmin: true },
      createContractSchema,
      true,
      'body',
    );
    expect(errors.some((e) => e.field === 'body.isAdmin')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// listContractsQuerySchema
// ---------------------------------------------------------------------------

describe('listContractsQuerySchema', () => {
  it('accepts empty query (all fields optional)', () => {
    expect(validateObject({}, listContractsQuerySchema, false, 'query')).toHaveLength(0);
  });

  it('accepts valid status value', () => {
    const errors = validateObject(
      { status: 'open' },
      listContractsQuerySchema,
      false,
      'query',
    );
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid status value (enum enforcement)', () => {
    const errors = validateObject(
      { status: 'pending' },
      listContractsQuerySchema,
      false,
      'query',
    );
    expect(errors.some((e) => e.field === 'query.status')).toBe(true);
  });

  it('accepts all valid status enum values', () => {
    for (const s of ['open', 'active', 'completed', 'disputed']) {
      const errors = validateObject({ status: s }, listContractsQuerySchema, false, 'query');
      expect(errors).toHaveLength(0);
    }
  });

  it('accepts a valid numeric limit string', () => {
    const errors = validateObject(
      { limit: '25' },
      listContractsQuerySchema,
      false,
      'query',
    );
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-numeric limit string', () => {
    const errors = validateObject(
      { limit: 'all' },
      listContractsQuerySchema,
      false,
      'query',
    );
    expect(errors.some((e) => e.field === 'query.limit')).toBe(true);
  });

  it('rejects limit string longer than 4 chars', () => {
    const errors = validateObject(
      { limit: '10000' },
      listContractsQuerySchema,
      false,
      'query',
    );
    expect(errors.some((e) => e.field === 'query.limit')).toBe(true);
  });
});
