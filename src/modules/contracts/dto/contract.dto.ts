import { z } from 'zod';
import { MAX_MILESTONES_PER_CONTRACT, milestoneSchema } from '../../../contracts/bounds';

export const createContractSchema = z.object({
  body: z.object({
    title: z.string().min(5).max(100),
    description: z.string().min(10),
    freelancerId: z.string().uuid().optional(),
    budget: z.number().positive(),
    milestones: z
      .array(milestoneSchema)
      .max(
        MAX_MILESTONES_PER_CONTRACT,
        `Cannot exceed ${MAX_MILESTONES_PER_CONTRACT} milestones per contract`,
      )
      .optional(),
  }),
});

registry.register('CreateContract', createContractSchema.shape.body);

export type CreateContractDto = z.infer<typeof createContractSchema>['body'];

export const updateContractSchema = z.object({
  body: z.object({
    version: z.number().int().min(0),
    title: z.string().min(5).max(100).optional(),
    status: z.enum(['draft', 'active', 'completed', 'disputed', 'cancelled']).optional(),
  }),
});

export type UpdateContractDto = z.infer<typeof updateContractSchema>['body'];
