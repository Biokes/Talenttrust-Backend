/**
 * @module middleware/validate
 * @description Generic request validation middleware factory.
 *
 * Validates `req.body`, `req.params`, and `req.query` against caller-supplied
 * schema objects. Uses a lightweight built-in validator — no external schema
 * library dependency — keeping the attack surface small.
 *
 * Usage:
 * ```ts
 * router.post('/', validate({ body: createContractSchema }), handler);
 * ```
 *
 * @security
 *  - Rejects payloads that contain unexpected fields (strict mode) to prevent
 *    mass-assignment / prototype-pollution vectors.
 *  - All validation errors are returned as structured JSON; raw error messages
 *    from user input are never reflected back verbatim.
 *  - Maximum body size is enforced upstream by express.json() — this middleware
 *    does not re-implement that concern.
 */

import { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported field types in a schema definition. */
export type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array';

/**
 * Definition for a single field in a schema.
 */
export interface FieldSchema {
  /** Expected JS typeof / array check. */
  type: FieldType;
  /** Whether the field must be present. Defaults to true. */
  required?: boolean;
  /** Minimum length (strings) or minimum value (numbers). */
  min?: number;
  /** Maximum length (strings) or maximum value (numbers). */
  max?: number;
  /** Regex pattern the string value must satisfy. */
  pattern?: RegExp;
  /** Allowed enum values. */
  enum?: unknown[];
}

/**
 * A schema is a plain object mapping field names to their FieldSchema.
 */
export type Schema = Record<string, FieldSchema>;

/**
 * Options passed to the `validate()` factory.
 */
export interface ValidateOptions {
  body?: Schema;
  params?: Schema;
  query?: Schema;
  /**
   * When true (default), fields not declared in the schema are rejected.
   * Set to false only when you intentionally allow pass-through fields.
   *
   * @security Strict mode prevents mass-assignment attacks.
   */
  strict?: boolean;
}

/**
 * A single validation error entry returned to the client.
 */
export interface ValidationError {
  field: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Core validator
// ---------------------------------------------------------------------------

/**
 * Validates a plain object against a schema.
 *
 * @param data   - The object to validate (req.body / req.params / req.query).
 * @param schema - Field definitions to validate against.
 * @param strict - Reject unknown fields when true.
 * @param prefix - Label prefix for error messages (e.g. "body", "params").
 * @returns Array of validation errors; empty array means valid.
 */
export function validateObject(
  data: Record<string, unknown>,
  schema: Schema,
  strict: boolean,
  prefix: string,
): ValidationError[] {
  const errors: ValidationError[] = [];

  // ── Unknown field check (strict mode) ────────────────────────────────────
  if (strict) {
    for (const key of Object.keys(data)) {
      if (!(key in schema)) {
        errors.push({ field: `${prefix}.${key}`, message: 'Unknown field' });
      }
    }
  }

  // ── Per-field validation ──────────────────────────────────────────────────
  for (const [field, rules] of Object.entries(schema)) {
    const required = rules.required !== false; // default: required
    const value = data[field];
    const qualifiedField = `${prefix}.${field}`;

    if (value === undefined || value === null) {
      if (required) {
        errors.push({ field: qualifiedField, message: 'Field is required' });
      }
      continue;
    }

    // Type check
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== rules.type) {
      errors.push({
        field: qualifiedField,
        message: `Expected type ${rules.type}, got ${actualType}`,
      });
      continue; // skip further checks — value is wrong type
    }

    // String-specific checks
    if (rules.type === 'string' && typeof value === 'string') {
      if (rules.min !== undefined && value.length < rules.min) {
        errors.push({
          field: qualifiedField,
          message: `Must be at least ${rules.min} characters`,
        });
      }
      if (rules.max !== undefined && value.length > rules.max) {
        errors.push({
          field: qualifiedField,
          message: `Must be at most ${rules.max} characters`,
        });
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push({ field: qualifiedField, message: 'Invalid format' });
      }
    }

    // Number-specific checks
    if (rules.type === 'number' && typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push({ field: qualifiedField, message: `Must be at least ${rules.min}` });
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push({ field: qualifiedField, message: `Must be at most ${rules.max}` });
      }
    }

    // Enum check
    if (rules.enum !== undefined && !rules.enum.includes(value)) {
      errors.push({
        field: qualifiedField,
        message: `Must be one of: ${rules.enum.join(', ')}`,
      });
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Middleware factory
// ---------------------------------------------------------------------------

/**
 * Returns an Express middleware that validates the request against the
 * provided schemas. Responds with 400 and a structured error list on failure.
 *
 * @param options - Schemas for body, params, and/or query; strict flag.
 */
export function validate(options: ValidateOptions) {
  const strict = options.strict !== false; // default strict = true

  return (req: Request, res: Response, next: NextFunction): void => {
    const allErrors: ValidationError[] = [];

    if (options.body) {
      const body =
        req.body && typeof req.body === 'object' && !Array.isArray(req.body)
          ? (req.body as Record<string, unknown>)
          : {};
      allErrors.push(...validateObject(body, options.body, strict, 'body'));
    }

    if (options.params) {
      allErrors.push(
        ...validateObject(req.params as Record<string, unknown>, options.params, strict, 'params'),
      );
    }

    if (options.query) {
      allErrors.push(
        ...validateObject(
          req.query as Record<string, unknown>,
          options.query,
          strict,
          'query',
        ),
      );
    }

    if (allErrors.length > 0) {
      res.status(400).json({ error: 'Validation failed', details: allErrors });
      return;
    }

    next();
  };
}
