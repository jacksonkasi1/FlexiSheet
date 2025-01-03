/**
 * sheet-table.tsx
 *
 * A reusable table component with editable cells, row/column disabling,
 * and custom data support. Integrates with Zod validation per column
 * using an optional validationSchema property in the column definition.
 */

import React, { useState, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  // Types from TanStack Table v8
  ColumnDef,
  TableOptions,
} from "@tanstack/react-table";
import type { ZodType, ZodTypeDef } from "zod";

/**
 * ExtendedColumnDef<TData, TValue>:
 * - Inherits everything from TanStack's ColumnDef<TData, TValue>
 * - Forces existence of optional `accessorKey?: string` and `id?: string` 
 *   in case your TanStack version doesn't define them.
 * - Adds our optional `validationSchema` property.
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
 * @template T - The type of data used in the table.
 */
interface SheetTableProps<T extends object> {
  /**
   * Extended columns that can include a validation schema.
   */
  columns: ExtendedColumnDef<T>[];

  /**
   * Array of data rows for the table.
   */
  data: T[];

  /**
   * Callback function triggered when a cell is edited (and passes validation).
   */
  onEdit?: <K extends keyof T>(rowIndex: number, columnId: K, value: T[K]) => void;

  /**
   * Array of column IDs that should be disabled (non-editable).
   */
  disabledColumns?: string[];

  /**
   * Array of row indexes that should be disabled (non-editable).
   */
  disabledRows?: number[];
}

/**
 * A reusable table component with:
 *  - Editable cells
 *  - Optional per-column Zod validation (real-time + onBlur)
 *  - Row/column disabling
 * 
 * @template T - The type of data used in the table.
 */
function SheetTable<T extends object>({
  columns,
  data,
  onEdit,
  disabledColumns = [],
  disabledRows = [],
}: SheetTableProps<T>) {
  /**
   * Local state to track cell-specific errors:
   * Keyed by rowIndex -> colKey (id/accessorKey).
   */
  const [cellErrors, setCellErrors] = useState<{
    [rowIndex: number]: { [colKey: string]: string | null };
  }>({});

  /**
   * Because ExtendedColumnDef<T> extends ColumnDef<T>,
   * the table can accept it directly with no casting needed.
   */
  const table = useReactTable<T>({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  } as TableOptions<T>); 
  // ^ The 'as TableOptions<T>' is a small workaround if TS complains.
  //   Some TS versions won't need this, depending on your config.

  /**
   * Helper to figure out a stable "column key" to store errors / check disabled.
   * We try: column.id -> column.accessorKey -> cell.column.id as fallback
   */
  const getColumnKey = (colDef: ExtendedColumnDef<T>) => {
    return colDef.id ?? colDef.accessorKey ?? "";
  };

  /**
   * Validate the given 'rawValue' for the specified column's Zod schema,
   * possibly converting strings to numbers if the schema is numeric.
   *
   * Returns an object: { parsedValue, errorMessage }
   */
  const validateCellValue = (
    rawValue: string,
    colDef: ExtendedColumnDef<T>
  ): { parsedValue: unknown; errorMessage: string | null } => {
    let parsedValue: unknown = rawValue;
    let errorMessage: string | null = null;

    const schema = colDef.validationSchema;
    if (!schema) {
      // No validation schema -> no error, just pass raw value
      return { parsedValue, errorMessage };
    }

    // 1) If it's a numeric schema, parse float
    const schemaType = (schema as any)?._def?.typeName;
    if (schemaType === "ZodNumber") {
      // If user cleared the cell and it's optional, allow undefined
      if (rawValue.trim() === "") {
        parsedValue = undefined;
      } else {
        const maybeNum = parseFloat(rawValue);
        parsedValue = isNaN(maybeNum) ? rawValue : maybeNum;
      }
    }

    // 2) Run the schema
    const result = schema.safeParse(parsedValue);
    if (!result.success) {
      // Use first error message
      errorMessage = result.error.issues[0].message;
    }

    return { parsedValue, errorMessage };
  };

  /**
   * Update or clear cell error in local state for a specific [rowIndex, colKey].
   */
  const setCellError = (
    rowIndex: number,
    colKey: string,
    errorMessage: string | null
  ) => {
    setCellErrors((prev) => {
      const rowErrors = { ...(prev[rowIndex] || {}) };
      rowErrors[colKey] = errorMessage;
      return { ...prev, [rowIndex]: rowErrors };
    });
  };

  /**
   * Common logic to handle input changes (real-time) or blur event
   * so we can show immediate validation feedback + logs.
   */
  const handleCellChange = (
    e: React.FormEvent<HTMLTableCellElement> | React.FocusEvent<HTMLTableCellElement>,
    rowIndex: number,
    colDef: ExtendedColumnDef<T>
  ) => {
    if (disabledRows.includes(rowIndex)) return;
    const colKey = getColumnKey(colDef);
    if (disabledColumns.includes(colKey)) return;

    const rawValue = e.currentTarget.textContent ?? "";
    const { parsedValue, errorMessage } = validateCellValue(rawValue, colDef);

    // 1) Update cell error highlight
    setCellError(rowIndex, colKey, errorMessage);

    // 2) Log errors in real-time if you want:
    if (errorMessage) {
      console.error(
        `Row ${rowIndex}, Column "${colKey}" error: ${errorMessage}`
      );
    } else {
      console.log(`Row ${rowIndex}, Column "${colKey}" is valid:`, parsedValue);
    }

    // 3) If valid, call onEdit to update state in parent
    if (!errorMessage && onEdit) {
      // We must cast colKey to keyof T so TS is happy
      onEdit(rowIndex, colKey as keyof T, parsedValue as T[keyof T]);
    }
  };

  /**
   * Restrict certain keystrokes if the column's schema is numeric (real-time).
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTableCellElement>, colDef: ExtendedColumnDef<T>) => {
      if (!colDef.validationSchema) return;

      const schemaType = (colDef.validationSchema as any)?._def?.typeName;
      if (schemaType === "ZodNumber") {
        // Allowed keys: digits, decimal, minus, backspace, arrow keys, etc.
        const allowedKeys = [
          "Backspace",
          "Delete",
          "ArrowLeft",
          "ArrowRight",
          "Tab",
          "Home",
          "End",
          ".", // decimal
          "-", // minus (if you allow negative)
        ];
        const isDigit = /^[0-9]$/.test(e.key);

        // Example check (customize as needed)
        if (!allowedKeys.includes(e.key) && !isDigit) {
          e.preventDefault();
        }
      }
    },
    []
  );

  return (
    <div className="p-4">
      <table className="table-auto w-full border-collapse border border-gray-200">
        <thead className="bg-gray-100">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="border border-gray-300 px-4 py-2 text-left"
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={disabledRows.includes(row.index) ? "bg-gray-300" : ""}
            >
              {row.getVisibleCells().map((cell) => {
                const colDef = cell.column.columnDef as ExtendedColumnDef<T>;
                const colKey = getColumnKey(colDef);

                // If row or column is disabled, content is not editable
                const isDisabled =
                  disabledRows.includes(row.index) || disabledColumns.includes(colKey);

                // Check if there's an error for this cell
                const hasError = cellErrors[row.index]?.[colKey] ?? null;

                return (
                  <td
                    key={cell.id}
                    className={`border border-gray-300 px-4 py-2
                      ${isDisabled ? "bg-gray-200" : ""}
                      ${hasError ? "bg-red-200" : ""}
                    `}
                    contentEditable={!isDisabled}
                    suppressContentEditableWarning
                    onKeyDown={(e) => handleKeyDown(e, colDef)}
                    // Validate in real-time on each keystroke or paste
                    onInput={(e) => handleCellChange(e, row.index, colDef)}
                    // Final check on blur
                    onBlur={(e) => handleCellChange(e, row.index, colDef)}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default SheetTable;
