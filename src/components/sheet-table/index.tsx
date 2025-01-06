/**
 * sheet-table/index.tsx
 *
 * A reusable table component with editable cells, row/column disabling,
 * and custom data support. Integrates with Zod validation per column
 * using an optional validationSchema property in the column definition.
 *
 * Adds grouping functionality based on a `headerKey` in the RowData.
 */

import React, { useState, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  TableOptions,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
 *  - Grouping rows by sub-header
 */
function SheetTable<T extends { headerKey?: string }>({
  columns,
  data,
  onEdit,
  disabledColumns = [],
  disabledRows = [],
  showHeader = true,
}: SheetTableProps<T>) {
  /**
   * We track errors by row/column, but NOT the content of each cell.
   * The DOM itself (contentEditable) holds the user-typed text until blur.
   */
  const [cellErrors, setCellErrors] = useState<
    Record<number, Record<string, string | null>>
  >({});

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
      colDef: ExtendedColumnDef<T>,
    ) => {
      const colKey = getColumnKey(colDef);
      if (disabledRows.includes(rowIndex) || disabledColumns.includes(colKey)) {
        return;
      }

      const rawValue = e.currentTarget.textContent ?? "";
      const { errorMessage } = parseAndValidate(rawValue, colDef);

      // Update state to reflect error
      setCellErrors((prev) =>
        setCellError(prev, rowIndex, colKey, errorMessage),
      );

      if (errorMessage) {
        console.error(
          `Row ${rowIndex}, Column "${colKey}" error: ${errorMessage}`,
        );
      } else {
        console.log(`Row ${rowIndex}, Column "${colKey}" is valid (typing)...`);
      }
    },
    [disabledColumns, disabledRows],
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
      colDef: ExtendedColumnDef<T>,
    ) => {
      const colKey = getColumnKey(colDef);
      if (disabledRows.includes(rowIndex) || disabledColumns.includes(colKey)) {
        return;
      }

      const rawValue = e.currentTarget.textContent ?? "";
      const { parsedValue, errorMessage } = parseAndValidate(rawValue, colDef);

      // Update state to reflect error
      setCellErrors((prev) =>
        setCellError(prev, rowIndex, colKey, errorMessage),
      );

      if (errorMessage) {
        console.error(
          `Row ${rowIndex}, Column "${colKey}" final error: ${errorMessage}`,
        );
      } else {
        console.log(
          `Row ${rowIndex}, Column "${colKey}" final valid:`,
          parsedValue,
        );
        // If no error, update parent state
        if (onEdit) {
          onEdit(rowIndex, colKey as keyof T, parsedValue as T[keyof T]);
        }
      }
    },
    [disabledColumns, disabledRows, onEdit],
  );

  /**
   * Group rows by the `headerKey` field.
   */
  const groupedData = data.reduce<{ [key: string]: T[] }>((acc, row) => {
    const group = row.headerKey || "ungrouped";
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(row);
    return acc;
  }, {});

  return (
    <div className="p-4">
      {/* Shadcn UI Table */}
      <Table>
        {/* Optional caption. Remove or modify if you don't need it. */}
        <TableCaption>Dynamic, editable data table with grouping.</TableCaption>

        {/* Conditional rendering of the header */}
        {showHeader && (
          <TableHeader>
            <TableRow>
              {table.getFlatHeaders().map((header) => (
                <TableHead key={header.id} className="text-left border">
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        )}

        <TableBody>
          {Object.entries(groupedData).map(([groupKey, rows], groupIndex) => (
            <React.Fragment key={groupKey}>
              {groupKey !== "ungrouped" && (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="font-bold bg-muted-foreground/10 border"
                  >
                    {groupKey}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row, rowIndex) => (
                <TableRow
                  key={`${groupIndex}-${rowIndex}`}
                  className={disabledRows.includes(rowIndex) ? "bg-muted" : ""}
                >
                  {table
                    .getRowModel()
                    .rows[rowIndex]?.getVisibleCells()
                    .map((cell) => {
                      const colDef = cell.column
                        .columnDef as ExtendedColumnDef<T>;
                      const colKey = getColumnKey(colDef);

                      // Determine if cell is disabled
                      const isDisabled =
                        disabledRows.includes(rowIndex) ||
                        disabledColumns.includes(colKey);

                      // Check for error
                      const errorMsg = cellErrors[rowIndex]?.[colKey] || null;

                      return (
                        <TableCell
                          key={cell.id}
                          className={`border  
                          ${isDisabled ? "bg-muted" : ""}
                          ${errorMsg ? "bg-destructive/25" : ""}
                        `}
                          // Make editable only if not disabled
                          contentEditable={!isDisabled}
                          suppressContentEditableWarning
                          // BLOCK invalid chars (letters) for numeric columns
                          onKeyDown={(e) => handleKeyDown(e, colDef)}
                          onPaste={(e) => handlePaste(e, colDef)}
                          // Real-time check => highlight errors or success logs
                          onInput={(e) => handleCellInput(e, rowIndex, colDef)}
                          // Final check => if valid => onEdit => updates parent
                          onBlur={(e) => handleCellBlur(e, rowIndex, colDef)}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      );
                    })}
                </TableRow>
              ))}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default SheetTable;
