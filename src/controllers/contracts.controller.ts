import { Request, Response, NextFunction } from 'express';
import { ContractsService } from '../services/contracts.service';
import { CreateContractDto } from '../modules/contracts/dto/contract.dto';
import { CONTRACT_BOUNDS, ContractBoundsError } from '../contracts/bounds';

const contractsService = new ContractsService();

/**
 * @dev Presentation layer for Contracts.
 * Handles HTTP requests, extracts parameters, and formulates responses.
 * Delegates core logic to the ContractsService.
 */
export class ContractsController {

  /**
   * GET /api/v1/contracts
   * Fetch a paginated list of escrow contracts.
   *
   * Query params:
   *   page  - positive integer, defaults to 1
   *   limit - positive integer 1..100, defaults to 20
   *
   * Returns 400 if page or limit are invalid (non-integer, negative, or out of range).
   */
  public static async getContracts(_req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = parsePaginationQuery((req.query ?? {}) as Record<string, unknown>);
      if (!pagination.ok) {
        res.status(400).json({
          status: 'error',
          message: pagination.error,
        });
        return;
      }

      const allContracts = await contractsService.getAllContracts();
      const { page, limit, offset } = pagination.value;
      const pageItems = applyPagination(allContracts, { page, limit, offset });
      const total = allContracts.length;

      res.status(200).json({
        status: 'success',
        data: pageItems,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/contracts
   * Create a new escrow contract metadata entry.
   */
  public static async createContract(req: Request, res: Response, next: NextFunction) {
    try {
      const data: CreateContractDto = req.body;
      const newContract = await contractsService.createContract(data);
      res.status(201).json({ status: 'success', data: newContract });
    } catch (error) {
      if (error instanceof ContractBoundsError) {
        res.status(422).json({ status: 'error', message: error.message });
        return;
      }
      next(error);
    }
  }

  /**
   * GET /api/v1/contracts/bounds
   * Returns the enforced per-contract limits for client discovery.
   */
  public static getBounds(_req: Request, res: Response) {
    res.status(200).json({ status: 'success', data: CONTRACT_BOUNDS });
  }
}
