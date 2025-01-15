/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * sheet-table.tsx
 *
 * A reusable table component with editable cells, row/column disabling,
 * and custom data support. Integrates with Zod validation per column
 * using an optional validationSchema property in the column definition.
 *
 * Key differences from previous versions:
 * - We do NOT re-render the cell content on every keystroke, so the cursor won't jump.
 * - We only call `onEdit` (and thus update parent state) onBlur, not on every keystroke.
 * - We still do real-time validation & highlighting by storing errors in component state.
 * - We block disallowed characters in numeric columns (letters, etc.).
 */

import React, { useState, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
  TableOptions,
} from "@tanstack/react-table";
import type { ZodType, ZodTypeDef } from "zod";

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
interface SheetTableProps<T extends object> {
  columns: ExtendedColumnDef<T>[];
  data: T[];
  onEdit?: <K extends keyof T>(rowIndex: number, columnId: K, value: T[K]) => void;
  disabledColumns?: string[];
  disabledRows?: number[];
}

/**
 * A reusable table component with:
 *  - Editable cells
 *  - Optional per-column Zod validation
 *  - Row/column disabling
 *  - Real-time error highlighting
 *  - Only final updates to parent onBlur
 */
function SheetTable<T extends object>({
  columns,
  data,
  onEdit,
  disabledColumns = [],
  disabledRows = [],
}: SheetTableProps<T>) {
  /**
   * We track errors by row/column, but NOT the content of each cell.
   * The DOM itself (contentEditable) holds the user-typed text until blur.
   */
  const [cellErrors, setCellErrors] = useState<Record<
    number,
    Record<string, string | null>
  >>({});

  /**
   * Initialize the table using TanStack Table
   */
  const table = useReactTable<T>({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  } as TableOptions<T>);

  /**
   * Returns a stable string key for each column (id > accessorKey > "").
   */
  const getColumnKey = (colDef: ExtendedColumnDef<T>) => {
    return colDef.id ?? colDef.accessorKey ?? "";
  };

  /**
   * Real-time validation (but we do NOT call onEdit here).
   * This helps us show error highlighting and console logs
   * without resetting the DOM text or cursor position.
   */
  const handleCellInput = useCallback(
    (
      e: React.FormEvent<HTMLTableCellElement>,
      rowIndex: number,
      colDef: ExtendedColumnDef<T>
    ) => {
      const colKey = getColumnKey(colDef);
      if (disabledRows.includes(rowIndex) || disabledColumns.includes(colKey)) {
        return;
      }

      const rawValue = e.currentTarget.textContent ?? "";
      const { errorMessage } = parseAndValidate(rawValue, colDef);

      setCellError(rowIndex, colKey, errorMessage);

      if (errorMessage) {
        console.error(`Row ${rowIndex}, Column "${colKey}" error: ${errorMessage}`);
      } else {
        console.log(`Row ${rowIndex}, Column "${colKey}" is valid (typing)...`);
      }
    },
    [disabledColumns, disabledRows, getColumnKey, parseAndValidate]
  );

  /**
   * Final check onBlur. If there's no error, we call onEdit to update parent state.
   * This means we do NOT lose the user’s cursor during typing, but still keep
   * the parent data in sync once the user finishes editing the cell.
   */
  const handleCellBlur = useCallback(
    (
      e: React.FocusEvent<HTMLTableCellElement>,
      rowIndex: number,
      colDef: ExtendedColumnDef<T>
    ) => {
      const colKey = getColumnKey(colDef);
      if (disabledRows.includes(rowIndex) || disabledColumns.includes(colKey)) {
        return;
      }

      const rawValue = e.currentTarget.textContent ?? "";
      const { parsedValue, errorMessage } = parseAndValidate(rawValue, colDef);

      setCellError(rowIndex, colKey, errorMessage);

      if (errorMessage) {
        console.error(
          `Row ${rowIndex}, Column "${colKey}" final error: ${errorMessage}`
        );
      } else {
        console.log(
          `Row ${rowIndex}, Column "${colKey}" final valid:`,
          parsedValue
        );
        // If no error, update parent state
        if (onEdit) {
          onEdit(rowIndex, colKey as keyof T, parsedValue as T[keyof T]);
        }
      }
    },
    [disabledColumns, disabledRows, onEdit,  getColumnKey, parseAndValidate]
  );

  /**
   * BLOCK non-numeric characters in numeric columns, including paste.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTableCellElement>, colDef: ExtendedColumnDef<T>) => {
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
    },
    []
  );

  /**
   * If user tries to paste in a numeric field, we check if it's valid digits.
   * If not, we block the paste. Alternatively, you can let them paste
   * then parse after, but that might cause partial invalid text mid-paste.
   */
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTableCellElement>, colDef: ExtendedColumnDef<T>) => {
      if (!colDef.validationSchema) return;
      const schemaType = (colDef.validationSchema as any)?._def?.typeName;
      if (schemaType === "ZodNumber") {
        const text = e.clipboardData.getData("text");
        // If the pasted text is not a valid float, block it.
        if (!/^-?\d*\.?\d*$/.test(text)) {
          e.preventDefault();
        }
      }
    },
    []
  );

  /**
   * Parse & validate helper:
   * - If colDef is numeric and empty => undefined (if optional)
   * - If colDef is numeric and invalid => produce error
   */
  function parseAndValidate(
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
  function setCellError(rowIndex: number, colKey: string, errorMsg: string | null) {
    setCellErrors((prev) => {
      const rowErrors = { ...prev[rowIndex] };
      rowErrors[colKey] = errorMsg;
      return { ...prev, [rowIndex]: rowErrors };
    });
  }

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

                // Determine if cell is disabled
                const isDisabled =
                  disabledRows.includes(row.index) || disabledColumns.includes(colKey);

                // Check for error
                const errorMsg = cellErrors[row.index]?.[colKey] || null;

                return (
                  <td
                    key={cell.id}
                    className={`border border-gray-300 px-4 py-2
                      ${isDisabled ? "bg-gray-200" : ""}
                      ${errorMsg ? "bg-red-200" : ""}
                    `}
                    // Make editable only if not disabled
                    contentEditable={!isDisabled}
                    suppressContentEditableWarning
                    // BLOCK invalid chars (letters) for numeric columns
                    onKeyDown={(e) => handleKeyDown(e, colDef)}
                    onPaste={(e) => handlePaste(e, colDef)}
                    // Real-time check => highlight errors or success logs
                    onInput={(e) => handleCellInput(e, row.index, colDef)}
                    // Final check => if valid => onEdit => updates parent
                    onBlur={(e) => handleCellBlur(e, row.index, colDef)}
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
