import { Router } from 'express';
import { ContractsController } from '../controllers/contracts.controller';
import { validateSchema } from '../middleware/validate.middleware';
import { createContractSchema } from '../modules/contracts/dto/contract.dto';
import { validateQuery } from '../middleware/validation';
import { paginationQuerySchema } from '../utils/pagination';

const router = Router();

router.get('/bounds', ContractsController.getBounds);

router.get('/', ContractsController.getContracts);

router.post(
  '/',
  validateSchema(createContractSchema),
  ContractsController.createContract,
);

export default router;
