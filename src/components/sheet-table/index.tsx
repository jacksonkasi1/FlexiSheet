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
  Row as TanStackRow,
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
 * @param {ExtendedColumnDef<T>[]} props.columns - Column definitions extended w/ optional validation schemas
 * @param {T[]} props.data - Array of data objects to display
 * @param {(rowIndex: number, columnId: keyof T, value: T[keyof T]) => void} [props.onEdit] - Callback when a cell finishes editing
 * @param {string[]} [props.disabledColumns] - Array of column keys to disable
 * @param {number[] | Record<string, number[]>} [props.disabledRows] - Row indices or record keyed by group => row indices
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
   * Instead of storing errors/original content keyed by (groupKey, rowIndex),
   * we will use (groupKey, rowId), where rowId is from the TanStack row.id.
   * This ensures consistent references even when data is grouped or reordered.
   */
  const [cellErrors, setCellErrors] = useState<
    Record<string, Record<string, Record<string, string | null>>>
  >({});
  const [cellOriginalContent, setCellOriginalContent] = useState<
    Record<string, Record<string, Record<string, string>>>
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
   * Finds the TanStack row for a given data row.
   * We need this to get row.id (the unique stable identifier).
   */
  const findTableRow = useCallback(
    (rowData: T): TanStackRow<T> | undefined => {
      return table.getRowModel().rows.find(
        (r) => r.original === rowData
      );
    },
    [table]
  );

  /**
   * Store a cell's original value whenever the user focuses that cell,
   * keyed by groupKey -> rowId -> colKey.
   */
  const handleCellFocus = useCallback(
    (
      e: React.FocusEvent<HTMLTableCellElement>,
      groupKey: string,
      rowData: T,
      colDef: ExtendedColumnDef<T>
    ) => {
      const tanStackRow = findTableRow(rowData);
      if (!tanStackRow) return; // Should not happen unless data changed mid-edit

      const rowId = tanStackRow.id;
      const colKey = getColumnKey(colDef);
      const initialText = e.currentTarget.textContent ?? "";

      setCellOriginalContent((prev) => {
        const groupContent = prev[groupKey] || {};
        const rowContent = { ...(groupContent[rowId] || {}), [colKey]: initialText };
        return { ...prev, [groupKey]: { ...groupContent, [rowId]: rowContent } };
      });
    },
    [findTableRow]
  );

  /**
   * Real-time validation (but we do NOT call onEdit here).
   * Show error highlighting as the user types.
   */
  const handleCellInput = useCallback(
    (
      e: React.FormEvent<HTMLTableCellElement>,
      groupKey: string,
      rowData: T,
      colDef: ExtendedColumnDef<T>
    ) => {
      const tanStackRow = findTableRow(rowData);
      if (!tanStackRow) return;

      const rowId = tanStackRow.id;
      const rowIndex = tanStackRow.index;
      const colKey = getColumnKey(colDef);

      if (
        isRowDisabled(disabledRows, groupKey, rowIndex) ||
        disabledColumns.includes(colKey)
      ) {
        return;
      }

      const rawValue = e.currentTarget.textContent ?? "";
      const { errorMessage } = parseAndValidate(rawValue, colDef);

      setCellErrors((prev) => {
        const groupErrors = prev[groupKey] || {};
        const rowErrors = { ...(groupErrors[rowId] || {}), [colKey]: errorMessage };
        return { ...prev, [groupKey]: { ...groupErrors, [rowId]: rowErrors } };
      });
    },
    [disabledColumns, disabledRows, findTableRow]
  );

  /**
   * OnBlur: if content changed from the original, we parse/validate. If valid => onEdit.
   */
  const handleCellBlur = useCallback(
    (
      e: React.FocusEvent<HTMLTableCellElement>,
      groupKey: string,
      rowData: T,
      colDef: ExtendedColumnDef<T>
    ) => {
      const tanStackRow = findTableRow(rowData);
      if (!tanStackRow) return;

      const rowId = tanStackRow.id;
      const rowIndex = tanStackRow.index;
      const colKey = getColumnKey(colDef);

      if (
        isRowDisabled(disabledRows, groupKey, rowIndex) ||
        disabledColumns.includes(colKey)
      ) {
        return;
      }

      const rawValue = e.currentTarget.textContent ?? "";
      const originalValue =
        cellOriginalContent[groupKey]?.[rowId]?.[colKey] ?? "";

      // If nothing changed, do nothing
      if (rawValue === originalValue) {
        return;
      }

      const { parsedValue, errorMessage } = parseAndValidate(rawValue, colDef);

      setCellErrors((prev) => {
        const groupErrors = prev[groupKey] || {};
        const rowErrors = { ...(groupErrors[rowId] || {}), [colKey]: errorMessage };
        return { ...prev, [groupKey]: { ...groupErrors, [rowId]: rowErrors } };
      });

      if (errorMessage) {
        console.error(
          `Group "${groupKey}", Row "${rowId}", Col "${colKey}" final error: ${errorMessage}`
        );
      } else if (onEdit) {
        // We pass tanStackRow.index for the parent's onEdit usage
        onEdit(tanStackRow.index, colKey as keyof T, parsedValue as T[keyof T]);
      }
    },
    [disabledColumns, disabledRows, findTableRow, cellOriginalContent, onEdit]
  );

  /**
   * Group rows by the `headerKey` field.
   */
  const groupedData = data.reduce<Record<string, T[]>>((acc, row) => {
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
        <TableCaption>
          Dynamic, editable data table with grouping.
        </TableCaption>

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
              {/* Group label row (if not ungrouped) */}
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

              {/* Actual data rows */}
              {rows.map((rowData) => {
                const tanStackRow = findTableRow(rowData);
                if (!tanStackRow) {
                  // If data changed significantly, skip
                  return null;
                }

                const rowId = tanStackRow.id;
                const rowIndex = tanStackRow.index;
                const disabled = isRowDisabled(disabledRows, groupKey, rowIndex);

                return (
                  <TableRow
                    key={rowId}
                    className={disabled ? "bg-muted" : ""}
                  >
                    {columns.map((colDef) => {
                      const colKey = getColumnKey(colDef);

                      const isDisabled =
                        disabled || disabledColumns.includes(colKey);

                      const errorMsg =
                        cellErrors[groupKey]?.[rowId]?.[colKey] || null;

                      return (
                        <TableCell
                          key={`${groupKey}-${rowId}-${colKey}`}
                          className={`border
                            ${isDisabled ? "bg-muted" : ""}
                            ${errorMsg ? "bg-destructive/25" : ""}
                          `}
                          contentEditable={!isDisabled}
                          suppressContentEditableWarning
                          onFocus={(e) =>
                            handleCellFocus(e, groupKey, rowData, colDef)
                          }
                          // Let user do Ctrl+A, C, X, Z, V etc.
                          onKeyDown={(e) => {
                            if (
                              (e.ctrlKey || e.metaKey) &&
                              ["a", "c", "x", "z", "v"].includes(e.key.toLowerCase())
                            ) {
                              return;
                            }
                            handleKeyDown(e, colDef);
                          }}
                          onPaste={(e) => handlePaste(e, colDef)}
                          onInput={(e) =>
                            handleCellInput(e, groupKey, rowData, colDef)
                          }
                          onBlur={(e) =>
                            handleCellBlur(e, groupKey, rowData, colDef)
                          }
                        >
                          {rowData[colDef.accessorKey ?? ""] as React.ReactNode}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default SheetTable;