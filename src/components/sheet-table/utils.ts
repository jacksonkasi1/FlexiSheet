/* eslint-disable @typescript-eslint/no-explicit-any,  @typescript-eslint/no-unused-vars */

/**
 * components/sheet-table/utils.ts
 *
 * Utility functions, types, and helpers used by the SheetTable component.
 * 
 * We include:
 * - ExtendedColumnDef and SheetTableProps
 * - parseAndValidate function
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
 * - Adds optional `className` and `style` properties for custom styling.
 */
export type ExtendedColumnDef<
  TData extends object,
  TValue = unknown
> = Omit<ColumnDef<TData, TValue>, "id" | "accessorKey"> & {
  id?: string;
  accessorKey?: string;
  validationSchema?: ZodType<any, ZodTypeDef, any>;
  className?: string | ((row: TData) => string); // Allows static or dynamic class names
  style?: React.CSSProperties; // style for inline styles
};


/**
 * Extended props for footer functionality.
 */
interface FooterProps {
  /**
   * totalRowValues:
   *  - Object mapping column ID/accessorKey => any
   *  - If provided, we render a special totals row at the bottom of the table.
   */
  totalRowValues?: Record<string, any>;

  /**
   * totalRowLabel:
   *  - A string label used to fill empty cells in the totals row.
   *  - Defaults to "" if omitted.
   */
  totalRowLabel?: string;

  /**
   * totalRowTitle:
   *  - A string displayed on a separate row above the totals row.
   *  - Shown only if totalRowValues is provided as well.
   */
  totalRowTitle?: string;

  /**
   * footerElement:
   *  - A React node rendered below the totals row.
   *  - If omitted, no extra footer node is rendered.
   */
  footerElement?: React.ReactNode;
}

/**
 * Props for the SheetTable component.
 * Includes footer props and additional TanStack table configurations.
 */
export interface SheetTableProps<T extends object> extends FooterProps {
  /**
   * Column definitions for the table.
   */
  columns: ExtendedColumnDef<T>[];

  /**
   * Data to be displayed in the table.
   */
  data: T[];

  /**
   * Callback for handling cell edits.
   */
  onEdit?: <K extends keyof T>(rowIndex: string, columnId: K, value: T[K]) => void;

  /**
   * Columns that are disabled for editing.
   */
  disabledColumns?: string[];

  /**
   * Rows that are disabled for editing.
   * Can be an array of row indices or a record mapping column IDs to row indices.
   */
  disabledRows?: number[] | Record<string, number[]>;

  /**
   * Whether to show the table header.
   */
  showHeader?: boolean;

  /**
   * Whether to show a secondary header below the main header.
   */
  showSecondHeader?: boolean;

  /**
   * Title for the secondary header, if enabled.
   */
  secondHeaderTitle?: string;

  /**
   * If true, column sizing is enabled. Sizes are tracked in local state.
   */
  enableColumnSizing?: boolean;

  /**
   * Additional table options to be passed directly to `useReactTable`.
   * Examples: initialState, columnResizeMode, etc.
   */
  tableOptions?: Partial<TableOptions<T>>;

  /**
   * Callback for when a cell is focused.
   */
  onCellFocus: (rowId: string) => void;
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
 * BLOCK non-numeric characters in numeric columns, including paste.
 * (We keep these separate so they're easy to import and use in the main component.)
 */

export function handleKeyDown<T extends object>(
  e: React.KeyboardEvent<HTMLTableCellElement | HTMLDivElement>,
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
  e: React.ClipboardEvent<HTMLTableCellElement | HTMLDivElement>,
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


/**
 * Helper function to determine if a row is disabled based on the provided
 * disabledRows prop. This prop can be either a simple array of row indices
 * or a record keyed by groupKey mapped to arrays of row indices.
 */
export function isRowDisabled(
  rows: number[] | Record<string, number[]> | undefined,
  groupKey: string,
  rowIndex: number
): boolean {
  if (!rows) return false;
  if (Array.isArray(rows)) {
    return rows.includes(rowIndex);
  }
  return rows[groupKey]?.includes(rowIndex) ?? false;
}