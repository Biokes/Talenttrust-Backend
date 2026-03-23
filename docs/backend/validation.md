# Validation Middleware — TalentTrust Backend

## Overview

All mutating endpoints are protected by a schema validation middleware layer
before any business logic runs. The middleware is zero-dependency — it uses
no external schema library, keeping the attack surface small.

## Architecture

```
src/
├── middleware/
│   └── validate.ts        # Generic middleware factory + core validator
└── schemas/
    └── contracts.ts       # Field schemas for /api/v1/contracts endpoints
```

## How It Works

```ts
// 1. Define a schema
const mySchema: Schema = {
  title: { type: 'string', required: true, min: 1, max: 120 },
  amount: { type: 'number', required: true, min: 0.000001 },
};

// 2. Apply to a route
router.post('/', validate({ body: mySchema }), handler);
```

The `validate()` factory accepts schemas for `body`, `params`, and `query`.
On failure it short-circuits with:

```json
{
  "error": "Validation failed",
  "details": [
    { "field": "body.amount", "message": "Must be at least 0.000001" }
  ]
}
```

## Supported Constraints

| Option | Applies to | Description |
|---|---|---|
| `type` | all | `string`, `number`, `boolean`, `object`, `array` |
| `required` | all | Defaults to `true` |
| `min` | string (length), number (value) | Lower bound |
| `max` | string (length), number (value) | Upper bound |
| `pattern` | string | Regex the value must match |
| `enum` | any | Allowed values list |

## Strict Mode

By default `strict: true` — any field not declared in the schema is rejected.
This prevents mass-assignment attacks where a caller sends extra fields
(e.g. `isAdmin: true`) hoping they reach the persistence layer.

Set `strict: false` only for read endpoints where pass-through query params
are intentional (e.g. pagination).

## Security Threat Model

| Threat | Mitigation |
|---|---|
| Mass-assignment | Strict mode rejects unknown fields |
| Oversized payloads | `max` length/value constraints; express.json() size limit upstream |
| Type confusion | Explicit type check per field; wrong type → 400, not crash |
| Negative/zero escrow amount | `min: 0.000001` on `amount` field |
| Prototype pollution | `__proto__` / `constructor` treated as unknown fields in strict mode |
| XSS via reflected input | Error messages never echo raw user input |
| Enum injection | `status` and similar fields constrained to explicit allow-list |

## Adding a New Schema

1. Add a file under `src/schemas/<domain>.ts`
2. Export a `Schema` object using `FieldSchema` types from `middleware/validate`
3. Import and pass to `validate({ body: mySchema })` in the route file
4. Add unit tests in `src/schemas/<domain>.test.ts`
