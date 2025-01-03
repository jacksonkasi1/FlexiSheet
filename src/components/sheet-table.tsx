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
  ColumnDef,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import type { ZodType } from "zod";

/**
 * Extended ColumnDef to include an optional validation schema for each column.
 */
export interface ExtendedColumnDef<T> extends ColumnDef<T, any> {
  /**
   * Optional Zod validation schema for this column.
   * If provided, the SheetTable will validate cell edits in real-time.
   */
  validationSchema?: ZodType<any>;
}

/**
 * Props for the SheetTable component.
 * @template T - The type of data used in the table.
 */
interface SheetTableProps<T> {
  /**
   * Array of column definitions for the table.
   * Optionally includes a Zod schema (validationSchema) per column.
   */
  columns: ExtendedColumnDef<T>[];

  /**
   * Array of data rows for the table.
   */
  data: T[];

  /**
   * Callback function triggered when a cell is edited (onBlur).
   * @param rowIndex - The index of the row being edited.
   * @param columnId - The column ID of the cell being edited.
   * @param value - The new value entered in the cell.
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
 *  - Optional per-column Zod validation
 *  - Row/column disabling
 * 
 * @template T - The type of data used in the table.
 * @param {SheetTableProps<T>} props - The props for the SheetTable component.
 */
function SheetTable<T extends object>({
  columns,
  data,
  onEdit,
  disabledColumns = [],
  disabledRows = [],
}: SheetTableProps<T>) {
  // Local state to track cell-specific errors:
  // Keyed by rowIndex -> columnId, storing an error message or null.
  const [cellErrors, setCellErrors] = useState<{
    [rowIndex: number]: { [colId: string]: string | null };
  }>({});

  // Create the table instance using TanStack Table
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  /**
   * Restrict certain keystrokes if the column's schema is numeric.
   * This is a naive approach checking the schema's _def typeName,
   * but in real scenarios, you might do a more robust check or
   * parse the schema differently (e.g. check if it's a ZodNumber).
   */
  const handleKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLTableCellElement>,
      colDef: ExtendedColumnDef<T>
    ) => {
      // If no validationSchema, do nothing
      if (!colDef.validationSchema) return;

      const schemaType = (colDef.validationSchema as any)?._def?.typeName;
      if (schemaType === "ZodNumber") {
        // Allowed keys: digits, decimal, minus, backspace, arrow keys, etc.
        // This is just an example; customize as needed.
        const allowedKeys = [
          "Backspace",
          "Delete",
          "ArrowLeft",
          "ArrowRight",
          "Tab",
          "Home",
          "End",
          ".", // decimal
        ];
        // If Shift is pressed with a digit => not allowed
        // If a normal character that is not a digit => block
        // Exception: minus sign if it is the first char, etc.

        const isDigit = /^[0-9]$/.test(e.key);

        if (!allowedKeys.includes(e.key) && !isDigit) {
          e.preventDefault();
        }
      }
    },
    []
  );

  /**
   * Handles editing of a cell upon blur event.
   * @param {number} rowIndex - The index of the row being edited.
   * @param {ExtendedColumnDef<T>} colDef - Column definition (including optional validation).
   * @param {any} value - The new value entered in the cell.
   */
  const handleCellEdit = (
    rowIndex: number,
    colDef: ExtendedColumnDef<T>,
    value: any
  ) => {
    // If the row or column is disabled, do nothing.
    if (disabledRows.includes(rowIndex) || disabledColumns.includes(colDef.id!)) {
      return;
    }

    // Attempt to parse numeric columns into a float
    // if the existing column schema is a ZodNumber.
    if (colDef.validationSchema) {
      const schemaType = (colDef.validationSchema as any)?._def?.typeName;
      if (schemaType === "ZodNumber") {
        // If user cleared the cell and it's optional, allow undefined
        if (value.trim() === "") {
          value = undefined;
        } else {
          const parsed = parseFloat(value);
          value = isNaN(parsed) ? value : parsed;
        }
      }
    }

    // Validate using the column's schema if it exists
    let errorMessage: string | null = null;
    if (colDef.validationSchema) {
      const result = colDef.validationSchema.safeParse(value);
      if (!result.success) {
        // Take the first error message
        errorMessage = result.error.issues[0].message;
      }
    }

    // Update local cellErrors state
    setCellErrors((prev) => {
      const rowErrors = { ...(prev[rowIndex] || {}) };
      rowErrors[colDef.id!] = errorMessage;
      return { ...prev, [rowIndex]: rowErrors };
    });

    // If we have no error, proceed to call onEdit
    if (!errorMessage && onEdit) {
      onEdit(rowIndex, colDef.id as keyof T, value);
    }
  };

  return (
    <div className="p-4">
      {/* Render the table */}
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
              className={`${disabledRows.includes(row.index) ? "bg-gray-300" : ""}`}
            >
              {row.getVisibleCells().map((cell) => {
                const colDef = cell.column.columnDef as ExtendedColumnDef<T>;
                const isDisabled =
                  disabledRows.includes(row.index) || disabledColumns.includes(colDef.id!);
                // Is there an error for this cell?
                const hasError = cellErrors[row.index]?.[colDef.id!] ?? null;

                return (
                  <td
                    key={cell.id}
                    className={`border border-gray-300 px-4 py-2
                      ${isDisabled ? "bg-gray-200" : ""}
                      ${hasError ? "bg-red-200" : ""}
                    `}
                    contentEditable={!isDisabled}
                    suppressContentEditableWarning
                    // Restrict certain key strokes for numeric columns
                    onKeyDown={(e) => handleKeyDown(e, colDef)}
                    // Validate on blur
                    onBlur={(e) => handleCellEdit(row.index, colDef, e.currentTarget.textContent || "")}
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
