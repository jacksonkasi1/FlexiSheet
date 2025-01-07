/**
 * sheet-table/index.tsx
 *
 * A reusable table component with editable cells, row/column disabling,
 * and custom data support. Integrates with Zod validation per column
 * using an optional validationSchema property in the column definition.
 *
 * Adds grouping functionality based on a `headerKey` in the row data.
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
  getColumnKey,
  handleKeyDown,
  handlePaste,
  isRowDisabled,
} from "./utils";

/**
 * A reusable table component with:
 *  - Editable cells
 *  - Optional per-column Zod validation
 *  - Row/column disabling
 *  - Real-time error highlighting
 *  - Only final updates to parent onBlur
 *  - Grouping rows by sub-header
 *
 * @template T
 * @param {object} props
 * @param {ExtendedColumnDef<T>[]} props.columns - Column definitions extended with optional validation schemas
 * @param {T[]} props.data - Array of data objects to display
 * @param {(rowIndex: number, columnId: keyof T, value: T[keyof T]) => void} [props.onEdit] - Optional callback for when a cell finishes editing (onBlur)
 * @param {string[]} [props.disabledColumns] - Array of column keys to disable
 * @param {number[] | Record<string, number[]>} [props.disabledRows] - Array of row indices or record keyed by group, each containing an array of row indices to disable
 * @param {boolean} [props.showHeader=true] - Whether to show the primary table header
 * @param {boolean} [props.showSecondHeader=false] - Whether to show a second header row
 * @param {string} [props.secondHeaderTitle=""] - Title to display if the second header row is shown
 */
function SheetTable<
  T extends Record<string, unknown> & { headerKey?: string }
>({
  columns,
  data,
  onEdit,
  disabledColumns = [],
  disabledRows = [],
  showHeader = true,
  showSecondHeader = false,
  secondHeaderTitle = "",
}: SheetTableProps<T>) {
  /**
   * Track errors by (groupKey, rowIndex, colKey) and
   * track each cell's original content on focus.
   */
  const [cellErrors, setCellErrors] = useState<
    Record<string, Record<number, Record<string, string | null>>>
  >({});
  const [cellOriginalContent, setCellOriginalContent] = useState<
    Record<string, Record<number, Record<string, string>>>
  >({});

  /**
   * Initialize the table using TanStack Table.
   */
  const table = useReactTable<T>({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  } as TableOptions<T>);

  /**
   * Store a cell's original value whenever the user focuses that cell.
   */
  const handleCellFocus = useCallback(
    (
      e: React.FocusEvent<HTMLTableCellElement>,
      groupKey: string,
      rowIndex: number,
      colDef: ExtendedColumnDef<T>
    ) => {
      const colKey = getColumnKey(colDef);
      const initialText = e.currentTarget.textContent ?? "";

      setCellOriginalContent((prev) => {
        const groupContent = prev[groupKey] || {};
        const rowContent = { ...groupContent[rowIndex], [colKey]: initialText };
        return { ...prev, [groupKey]: { ...groupContent, [rowIndex]: rowContent } };
      });
    },
    []
  );

  /**
   * Real-time validation (but we do NOT call onEdit here).
   * This helps us show error highlighting without resetting
   * DOM text or cursor position as the user types.
   */
  const handleCellInput = useCallback(
    (
      e: React.FormEvent<HTMLTableCellElement>,
      groupKey: string,
      rowIndex: number,
      colDef: ExtendedColumnDef<T>
    ) => {
      const colKey = getColumnKey(colDef);

      if (
        isRowDisabled(disabledRows, groupKey, rowIndex) ||
        disabledColumns.includes(colKey)
      ) {
        return;
      }

      const rawValue = e.currentTarget.textContent ?? "";
      const { errorMessage } = parseAndValidate(rawValue, colDef);

      // Update error state
      setCellErrors((prev) => {
        const groupErrors = prev[groupKey] || {};
        const rowErrors = { ...groupErrors[rowIndex], [colKey]: errorMessage };
        return { ...prev, [groupKey]: { ...groupErrors, [rowIndex]: rowErrors } };
      });
    },
    [disabledColumns, disabledRows]
  );

  /**
   * OnBlur: Only update the parent if the text actually changed from the original.
   */
  const handleCellBlur = useCallback(
    (
      e: React.FocusEvent<HTMLTableCellElement>,
      groupKey: string,
      rowIndex: number,
      colDef: ExtendedColumnDef<T>
    ) => {
      const colKey = getColumnKey(colDef);

      if (
        isRowDisabled(disabledRows, groupKey, rowIndex) ||
        disabledColumns.includes(colKey)
      ) {
        return;
      }

      const rawValue = e.currentTarget.textContent ?? "";
      const originalValue =
        cellOriginalContent[groupKey]?.[rowIndex]?.[colKey] ?? "";

      // If the user didn't change anything, skip updating.
      if (rawValue === originalValue) {
        return;
      }

      const { parsedValue, errorMessage } = parseAndValidate(rawValue, colDef);
      setCellErrors((prev) => {
        const groupErrors = prev[groupKey] || {};
        const rowErrors = { ...groupErrors[rowIndex], [colKey]: errorMessage };
        return { ...prev, [groupKey]: { ...groupErrors, [rowIndex]: rowErrors } };
      });

      if (errorMessage) {
        console.error(
          `Group "${groupKey}", Row ${rowIndex}, Column "${colKey}" final error: ${errorMessage}`
        );
      } else if (onEdit) {
        onEdit(rowIndex, colKey as keyof T, parsedValue as T[keyof T]);
      }
    },
    [disabledColumns, disabledRows, onEdit, cellOriginalContent]
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
      <Table>
        {/* Optional caption. Modify or remove as needed. */}
        <TableCaption>Dynamic, editable data table with grouping.</TableCaption>

        {/* Primary header */}
        {showHeader && (
          <TableHeader>
            <TableRow>
              {table.getFlatHeaders().map((header) => (
                <TableHead key={header.id} className="text-left border">
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        )}

        {/* Optional second header */}
        {showSecondHeader && secondHeaderTitle && (
          <TableRow>
            <TableHead colSpan={columns.length} className="text-center border">
              {secondHeaderTitle}
            </TableHead>
          </TableRow>
        )}

        <TableBody>
          {Object.entries(groupedData).map(([groupKey, rows]) => (
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
                  key={`${groupKey}-${rowIndex}`}
                  className={
                    isRowDisabled(disabledRows, groupKey, rowIndex) ? "bg-muted" : ""
                  }
                >
                  {columns.map((colDef, colIndex) => {
                    const colKey = getColumnKey(colDef);

                    const isDisabled =
                      isRowDisabled(disabledRows, groupKey, rowIndex) ||
                      disabledColumns.includes(colKey);

                    const errorMsg =
                      cellErrors[groupKey]?.[rowIndex]?.[colKey] || null;

                    return (
                      <TableCell
                        key={`${groupKey}-${rowIndex}-${colIndex}`}
                        className={`border
                          ${isDisabled ? "bg-muted" : ""}
                          ${errorMsg ? "bg-destructive/25" : ""}
                        `}
                        contentEditable={!isDisabled}
                        suppressContentEditableWarning
                        // Capture cell's original value on focus:
                        onFocus={(e) => handleCellFocus(e, groupKey, rowIndex, colDef)}
                        // Allow Ctrl/Cmd + A, C, X, Z, V without blocking:
                        onKeyDown={(e) => {
                          if (
                            (e.ctrlKey || e.metaKey) &&
                            ["a", "c", "x", "z", "v"].includes(e.key.toLowerCase())
                          ) {
                            // Let the user perform select, copy, cut, or paste
                            return;
                          }
                          handleKeyDown(e, colDef);
                        }}
                        onPaste={(e) => handlePaste(e, colDef)}
                        onInput={(e) => handleCellInput(e, groupKey, rowIndex, colDef)}
                        onBlur={(e) => handleCellBlur(e, groupKey, rowIndex, colDef)}
                      >
                        {row[colDef.accessorKey || ""] as React.ReactNode}
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