import { z } from 'zod';
import { paginationQuerySchema as basePaginationQuerySchema } from '../../utils/pagination';

export const createContractMetadataSchema = z.object({
  key: z.string()
    .min(1, 'Key is required')
    .max(255, 'Key must be 255 characters or less')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Key can only contain alphanumeric characters, underscores, and hyphens'),
  value: z.string()
    .min(1, 'Value is required')
    .max(10000, 'Value must be 10000 characters or less'),
  data_type: z.enum(['string', 'number', 'boolean', 'json'])
    .default('string')
    .optional(),
  is_sensitive: z.boolean()
    .default(false)
    .optional()
});

export const updateContractMetadataSchema = z.object({
  value: z.string()
    .min(1, 'Value is required')
    .max(10000, 'Value must be 10000 characters or less')
    .optional(),
  is_sensitive: z.boolean()
    .optional()
}).strict();

export const contractIdParamsSchema = z.object({
  contractId: z.string().uuid('Invalid contract ID format')
});

export const metadataIdParamsSchema = z.object({
  contractId: z.string().uuid('Invalid contract ID format'),
  id: z.string().uuid('Invalid metadata ID format')
});

export const paginationQuerySchema = basePaginationQuerySchema.extend({
  key: z.string().optional(),
  data_type: z.enum(['string', 'number', 'boolean', 'json']).optional(),
});
