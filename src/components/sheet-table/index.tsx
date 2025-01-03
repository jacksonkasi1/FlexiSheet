/**
 * sheet-table/index.tsx
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
  TableOptions,
} from "@tanstack/react-table";

import {
  ExtendedColumnDef,
  SheetTableProps,
  parseAndValidate,
  setCellError,
  getColumnKey,
  handleKeyDown,
  handlePaste,
} from "./utils";

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

      // Update state to reflect error
      setCellErrors((prev) => setCellError(prev, rowIndex, colKey, errorMessage));

      if (errorMessage) {
        console.error(`Row ${rowIndex}, Column "${colKey}" error: ${errorMessage}`);
      } else {
        console.log(`Row ${rowIndex}, Column "${colKey}" is valid (typing)...`);
      }
    },
    [disabledColumns, disabledRows]
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

      // Update state to reflect error
      setCellErrors((prev) => setCellError(prev, rowIndex, colKey, errorMessage));

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
    [disabledColumns, disabledRows, onEdit]
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
