import { ContractsService } from './contracts.service';
import { SorobanService } from './soroban.service';
import { ContractBoundsError } from '../contracts/bounds';
import { MAX_MILESTONES_PER_CONTRACT, MAX_CONTRACT_AMOUNT_STROOPS } from '../contracts/bounds';

jest.mock('./soroban.service');

describe('ContractsService', () => {
  let contractsService: ContractsService;

  beforeEach(() => {
    contractsService = new ContractsService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllContracts', () => {
    it('returns an empty array initially', async () => {
      const contracts = await contractsService.getAllContracts();
      expect(contracts).toEqual([]);
    });
  });

  describe('createContract', () => {
    it('creates a contract and calls SorobanService.prepareEscrow', async () => {
      const contractData = {
        title: 'Build a frontend',
        description: 'React TS development',
        budget: 500,
      };

      const result = await contractsService.createContract(contractData);

      expect(result).toMatchObject({
        title: 'Build a frontend',
        description: 'React TS development',
        budget: 500,
        status: 'PENDING',
      });
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();

      const mockPrepareEscrow = SorobanService.prototype.prepareEscrow as jest.Mock;
      expect(mockPrepareEscrow).toHaveBeenCalledWith(result.id, 500);
    });

    it('creates a contract with milestones within bounds', async () => {
      const contractData = {
        title: 'Build a frontend',
        description: 'React TS development',
        budget: 1000,
        milestones: [
          { title: 'Phase 1', amount: 500 },
          { title: 'Phase 2', amount: 500 },
        ],
      };

      const result = await contractsService.createContract(contractData);
      expect(result.status).toBe('PENDING');
      expect(result.milestones).toHaveLength(2);
    });

    it('throws ContractBoundsError when budget exceeds cap', async () => {
      const contractData = {
        title: 'Big contract',
        description: 'Very large budget',
        budget: MAX_CONTRACT_AMOUNT_STROOPS + 1,
      };

      await expect(contractsService.createContract(contractData)).rejects.toThrow(
        ContractBoundsError,
      );
      await expect(contractsService.createContract(contractData)).rejects.toThrow(
        /Budget exceeds/,
      );
    });

    it('throws ContractBoundsError when milestone count exceeds cap', async () => {
      const milestones = Array.from({ length: MAX_MILESTONES_PER_CONTRACT + 1 }, (_, i) => ({
        title: `M${i}`,
        amount: 1,
      }));

      await expect(
        contractsService.createContract({
          title: 'Too many milestones',
          description: 'Exceeds milestone limit',
          budget: 100,
          milestones,
        }),
      ).rejects.toThrow(ContractBoundsError);
    });

    it('throws ContractBoundsError when total milestone amount exceeds cap', async () => {
      const milestones = [
        { title: 'A', amount: MAX_CONTRACT_AMOUNT_STROOPS },
        { title: 'B', amount: 1 },
      ];

      await expect(
        contractsService.createContract({
          title: 'Overflow milestones',
          description: 'Total exceeds amount cap',
          budget: 100,
          milestones,
        }),
      ).rejects.toThrow(ContractBoundsError);
    });

    it('does not persist contract when bounds are violated', async () => {
      await expect(
        contractsService.createContract({
          title: 'Big contract',
          description: 'Over the limit',
          budget: MAX_CONTRACT_AMOUNT_STROOPS + 1,
        }),
      ).rejects.toThrow(ContractBoundsError);

      const contracts = await contractsService.getAllContracts();
      expect(contracts).toHaveLength(0);
    });
  });
});
