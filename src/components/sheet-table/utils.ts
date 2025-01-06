/* eslint-disable @typescript-eslint/no-explicit-any,  @typescript-eslint/no-unused-vars */

/**
 * components/sheet-table/utils.ts
 *
 * Utility functions, types, and helpers used by the SheetTable component.
 * 
 * We include:
 * - ExtendedColumnDef and SheetTableProps
 * - parseAndValidate function
 * - setCellError function
 * - getColumnKey function
 * - handleKeyDown, handlePaste
 * 
 * This is purely for organization: the code is identical in functionality
 * to what was previously in sheet-table.tsx (just split out).
 */

import type { ColumnDef, TableOptions } from "@tanstack/react-table";
import type { ZodType, ZodTypeDef } from "zod";
import React from "react";

/**
 * ExtendedColumnDef<TData, TValue>:
 * - Inherits everything from TanStack's ColumnDef<TData, TValue>
 * - Forces existence of optional `accessorKey?: string` and `id?: string`
 * - Adds our optional `validationSchema` property (for column-level Zod).
 */
export type ExtendedColumnDef<
  TData extends object,
  TValue = unknown
> = Omit<ColumnDef<TData, TValue>, "id" | "accessorKey"> & {
  id?: string;
  accessorKey?: string;
  validationSchema?: ZodType<any, ZodTypeDef, any>;
};

/**
 * Props for the SheetTable component.
 */
export interface SheetTableProps<T extends object> {
  columns: ExtendedColumnDef<T>[];
  data: T[];
  onEdit?: <K extends keyof T>(rowIndex: number, columnId: K, value: T[K]) => void;
  disabledColumns?: string[];
  disabledRows?: number[];
  showHeader?: boolean;
}

/**
 * Returns a stable string key for each column (id > accessorKey > "").
 */
export function getColumnKey<T extends object>(colDef: ExtendedColumnDef<T>): string {
  return colDef.id ?? colDef.accessorKey ?? "";
}

/**
 * Parse & validate helper:
 * - If colDef is numeric and empty => undefined (if optional)
 * - If colDef is numeric and invalid => produce error
 */
export function parseAndValidate<T extends object>(
  rawValue: string,
  colDef: ExtendedColumnDef<T>
): { parsedValue: unknown; errorMessage: string | null } {
  const schema = colDef.validationSchema;
  if (!schema) {
    // No validation => no error
    return { parsedValue: rawValue, errorMessage: null };
  }

  let parsedValue: unknown = rawValue;
  let errorMessage: string | null = null;

  const schemaType = (schema as any)?._def?.typeName;
  if (schemaType === "ZodNumber") {
    // If empty => undefined (if optional this is okay, otherwise error)
    if (rawValue.trim() === "") {
      parsedValue = undefined;
    } else {
      // Try parse to float
      const maybeNum = parseFloat(rawValue);
      // If the user typed something that parseFloat sees as NaN, it's an error
      parsedValue = Number.isNaN(maybeNum) ? rawValue : maybeNum;
    }
  }

  const result = schema.safeParse(parsedValue);
  if (!result.success) {
    errorMessage = result.error.issues[0].message;
  }

  return { parsedValue, errorMessage };
}

/**
 * Set or clear an error for a specific [rowIndex, colKey].
 */
export function setCellError(
  prevErrors: Record<number, Record<string, string | null>>,
  rowIndex: number,
  colKey: string,
  errorMsg: string | null
): Record<number, Record<string, string | null>> {
  const rowErrors = { ...prevErrors[rowIndex] };
  rowErrors[colKey] = errorMsg;
  return { ...prevErrors, [rowIndex]: rowErrors };
}

/**
 * BLOCK non-numeric characters in numeric columns, including paste.
 * (We keep these separate so they're easy to import and use in the main component.)
 */

export function handleKeyDown<T extends object>(
  e: React.KeyboardEvent<HTMLTableCellElement>,
  colDef: ExtendedColumnDef<T>
) {
  if (!colDef.validationSchema) return;

  const schemaType = (colDef.validationSchema as any)?._def?.typeName;
  if (schemaType === "ZodNumber") {
    // Allowed keys for numeric input:
    const allowedKeys = [
      "Backspace",
      "Delete",
      "ArrowLeft",
      "ArrowRight",
      "Tab",
      "Home",
      "End",
      ".",
      "-",
    ];
    const isDigit = /^[0-9]$/.test(e.key);

    if (!allowedKeys.includes(e.key) && !isDigit) {
      e.preventDefault();
    }
  }
}

export function handlePaste<T extends object>(
  e: React.ClipboardEvent<HTMLTableCellElement>,
  colDef: ExtendedColumnDef<T>
) {
  if (!colDef.validationSchema) return;
  const schemaType = (colDef.validationSchema as any)?._def?.typeName;
  if (schemaType === "ZodNumber") {
    const text = e.clipboardData.getData("text");
    // If the pasted text is not a valid float, block it.
    if (!/^-?\d*\.?\d*$/.test(text)) {
      e.preventDefault();
    }
  }
}
