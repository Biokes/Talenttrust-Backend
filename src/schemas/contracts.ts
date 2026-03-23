/**
 * @module schemas/contracts
 * @description Validation schemas for the /api/v1/contracts endpoints.
 *
 * Each schema is a plain `Schema` object consumed by the `validate()`
 * middleware factory. Keeping schemas in a dedicated module makes them
 * independently testable and easy to audit.
 *
 * @security
 *  - `clientId` and `freelancerId` are validated as non-empty strings with a
 *    max length to prevent oversized payloads reaching business logic.
 *  - `amount` is bounded to a positive number to prevent negative-value
 *    exploits in escrow calculations.
 *  - `status` is constrained to an explicit enum — no free-text injection.
 */

import { Schema } from '../middleware/validate';

/**
 * Schema for POST /api/v1/contracts — create a new escrow contract.
 *
 * Required fields:
 *  - `title`       string, 1–120 chars
 *  - `clientId`    string, 1–64 chars
 *  - `freelancerId` string, 1–64 chars
 *  - `amount`      number, > 0, ≤ 1_000_000
 *
 * Optional fields:
 *  - `description` string, 0–500 chars
 */
export const createContractSchema: Schema = {
  title: {
    type: 'string',
    required: true,
    min: 1,
    max: 120,
  },
  clientId: {
    type: 'string',
    required: true,
    min: 1,
    max: 64,
  },
  freelancerId: {
    type: 'string',
    required: true,
    min: 1,
    max: 64,
  },
  amount: {
    type: 'number',
    required: true,
    min: 0.000001, // smallest meaningful Stellar stroops equivalent
    max: 1_000_000,
  },
  description: {
    type: 'string',
    required: false,
    min: 0,
    max: 500,
  },
};

/**
 * Schema for GET /api/v1/contracts query parameters.
 *
 * Optional fields:
 *  - `status`  one of: 'open' | 'active' | 'completed' | 'disputed'
 *  - `limit`   string (query params are always strings; coerce in handler)
 */
export const listContractsQuerySchema: Schema = {
  status: {
    type: 'string',
    required: false,
    enum: ['open', 'active', 'completed', 'disputed'],
  },
  limit: {
    type: 'string',
    required: false,
    pattern: /^\d+$/,
    max: 4, // max "9999" — prevents absurdly large limit strings
  },
};
