/**
 * @module routes/contracts
 * @description Contract metadata routes.
 *
 * Handles CRUD-style operations for TalentTrust escrow contract metadata.
 * Actual on-chain interactions are delegated to the Stellar/Soroban layer
 * (not yet implemented — tracked in docs/backend/architecture.md).
 *
 * All mutating endpoints are protected by the `validate()` middleware which
 * enforces strict schema checks before any business logic runs.
 *
 * @route GET  /api/v1/contracts          List contracts (optional query filters)
 * @route POST /api/v1/contracts          Create a new contract
 */

import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate';
import { createContractSchema, listContractsQuerySchema } from '../schemas/contracts';

export const contractsRouter = Router();

/**
 * GET /api/v1/contracts
 * Returns the list of contracts, optionally filtered by query params.
 */
contractsRouter.get(
  '/',
  validate({ query: listContractsQuerySchema, strict: false }),
  (_req: Request, res: Response) => {
    res.status(200).json({ contracts: [] });
  },
);

/**
 * POST /api/v1/contracts
 * Creates a new escrow contract from a validated request body.
 *
 * @security Body is validated in strict mode — unknown fields are rejected
 *           to prevent mass-assignment attacks.
 */
contractsRouter.post(
  '/',
  validate({ body: createContractSchema }),
  (req: Request, res: Response) => {
    // Placeholder: persist to DB / submit to Soroban in a future iteration.
    res.status(201).json({ contract: req.body });
  },
);
