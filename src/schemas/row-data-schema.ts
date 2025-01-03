/**
 * row-data-schema.ts
 * 
 * Defines the Zod schema and TypeScript types for table row data.
 * Each property corresponds to a column in the table.
 */

import { z } from "zod";

/**
 * Zod schema for row data validation.
 * - materialName: must be a non-empty string.
 * - cft: must be a number >= 0 (no upper bound set here).
 * - rate: must be a number >= 0 and <= 10000.
 * - amount: must be a number >= 0 (no upper bound set here).
 */
export const rowDataZodSchema = z.object({
  materialName: z
    .string()
    .min(1, "Material name cannot be empty."),
  cft: z
    .number()
    .min(0, "CFT cannot be negative.")
    .optional(),
  rate: z
    .number()
    .min(0, "Rate cannot be negative.")
    .max(10000, "Rate cannot exceed 10000."),
  amount: z
    .number()
    .min(0, "Amount cannot be negative."),
});

/**
 * The inferred TypeScript type for row data based on the Zod schema.
 */
export type RowData = z.infer<typeof rowDataZodSchema>;
