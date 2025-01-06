/**
 * row-data-schema.ts
 *
 * Defines the Zod schema and TypeScript types for table row data.
 */

import { z } from "zod";

/**
 * Zod schema for row data validation.
 */
export const rowDataZodSchema = z.object({
  headerKey: z.string().optional(), // NOTE: Key to define grouping (optional).
  materialName: z.string().min(1, "Material name cannot be empty."),
  cft: z.number().min(0, "CFT cannot be negative."),
  // .optional(), // BUG: Optional fields are not validated properly as number.
  rate: z.number().min(0, "Rate cannot be negative.").max(10000, "Rate cannot exceed 10000."),
  amount: z.number().min(0, "Amount cannot be negative."),
});

/**
 * The inferred TypeScript type for row data based on the Zod schema.
 */
export type RowData = z.infer<typeof rowDataZodSchema>;
