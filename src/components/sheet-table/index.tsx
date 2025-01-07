/**
 * sheet-table/index.tsx
 *
 * A reusable table component with editable cells, row/column disabling,
 * custom data support, and Zod validation. Supports:
 *  - Grouping rows by a `headerKey`
 *  - A configurable footer (totals row + custom element)
 *  - TanStack Table column sizing (size, minSize, maxSize)
 *  - Forwarding other TanStack Table configuration via tableOptions
 */

import React, { useState, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  TableOptions,
  Row as TanStackRow,
  ColumnSizingState, // for type
  // ColumnDef,          // for type if needed
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
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
 * Extended props to forward additional TanStack Table config.
 * e.g., enabling resizing, customizing columnResizeMode, etc.
 */
interface ExtraTanStackProps<T> {
  /**
   * If true, column sizing is enabled. We track sizes in local state.
   */
  enableColumnSizing?: boolean;

  /**
   * Additional table options that you want to pass directly to useReactTable.
   * For example: initialState, columnResizeMode, etc.
   */
  tableOptions?: Partial<TableOptions<T>>;
}

/**
 * Combine your existing SheetTableProps with the extra TanStack props.
 */
type SheetTableAllProps<T extends Record<string, unknown>> = 
  SheetTableProps<T> & 
  ExtraTanStackProps<T>;

/**
 * The main SheetTable component, now with optional column sizing support.
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

  // Footer props
  totalRowValues,
  totalRowLabel = "",
  totalRowTitle,
  footerElement,

  // Additional TanStack config
  enableColumnSizing = false,
  tableOptions = {},
}: SheetTableAllProps<T>) {
  /**
   * If column sizing is enabled, we track sizes in state. 
   * This allows the user to define 'size', 'minSize', 'maxSize' in the column definitions.
   */
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});

  /**
   * We still track errors/original content keyed by (groupKey, rowId) for editing.
   */
  const [cellErrors, setCellErrors] = useState<
    Record<string, Record<string, Record<string, string | null>>>
  >({});
  const [cellOriginalContent, setCellOriginalContent] = useState<
    Record<string, Record<string, Record<string, string>>>
  >({});

  /**
   * Build the final table options. Merge user-provided tableOptions with ours.
   */
  const mergedOptions: TableOptions<T> = {
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),

    // If sizing is enabled, pass sizing states:
    ...(enableColumnSizing
      ? {
          state: {
            // If user also provided tableOptions.state, merge them
            ...tableOptions.state,
            columnSizing,
          },
          onColumnSizingChange: setColumnSizing,
          columnResizeMode: tableOptions.columnResizeMode ?? "onChange",
        }
      : {}),
    // Spread any additional user-provided table options
    ...tableOptions,
  } as TableOptions<T>;

  /**
   * Initialize the table using TanStack Table.
   */
  const table = useReactTable<T>(mergedOptions);

  /**
   * Finds the TanStack row for a given data row (to get row.id).
   */
  const findTableRow = useCallback(
    (rowData: T): TanStackRow<T> | undefined => {
      return table.getRowModel().rows.find((r) => r.original === rowData);
    },
    [table]
  );

  /**
   * Store a cell's original value on focus, for detecting changes on blur.
   */
  const handleCellFocus = useCallback(
    (
      e: React.FocusEvent<HTMLTableCellElement>,
      groupKey: string,
      rowData: T,
      colDef: ExtendedColumnDef<T>
    ) => {
      const tanStackRow = findTableRow(rowData);
      if (!tanStackRow) return;

      const rowId = tanStackRow.id;
      const colKey = getColumnKey(colDef);
      const initialText = e.currentTarget.textContent ?? "";

      setCellOriginalContent((prev) => {
        const groupContent = prev[groupKey] || {};
        const rowContent = {
          ...(groupContent[rowId] || {}),
          [colKey]: initialText,
        };
        return { ...prev, [groupKey]: { ...groupContent, [rowId]: rowContent } };
      });
    },
    [findTableRow]
  );

  /**
   * Real-time validation on each keystroke (but no onEdit call here).
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
   * OnBlur: if content changed from the original, parse/validate. If valid => onEdit.
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
        // We pass tanStackRow.index for the parent's usage
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

  /**
   * Renders optional footer content (rows) inside a <TableFooter>.
   */
  function renderFooter() {
    if (!totalRowValues && !footerElement) return null;

    return (
      <TableFooter>
        {/* If there's a totalRowTitle, show it in a single row */}
        {totalRowTitle && (
          <TableRow>
            <TableCell
              colSpan={columns.length}
              className="border text-center font-semibold"
            >
              {totalRowTitle}
            </TableCell>
          </TableRow>
        )}

        {/* The totals row */}
        {totalRowValues && (
          <TableRow>
            {columns.map((colDef, index) => {
              const colKey = getColumnKey(colDef);
              const cellValue = totalRowValues[colKey];

              // Provide a default string if totalRowLabel is not passed and this is the first cell
              const displayValue =
                cellValue !== undefined
                  ? cellValue
                  : index === 0
                  ? totalRowLabel || ""
                  : "";

              // Always apply the border to the first cell (left edge)
              // or any cell that has a displayValue.
              const applyBorder = index === 0 || displayValue !== "";

              return (
                <TableCell
                  key={`total-${colKey}`}
                  className={`font-bold ${applyBorder ? "border" : ""}`}
                >
                  {displayValue}
                </TableCell>
              );
            })}
          </TableRow>
        )}

        {/* If a footerElement is provided, render it after the totals row */}
        {footerElement}
      </TableFooter>
    );
  }

  return (
    <div className="p-4">
      <Table>
        <TableCaption>Dynamic, editable data table with grouping.</TableCaption>

        {/* Primary header */}
        {showHeader && (
          <TableHeader>
            <TableRow>
              {table.getHeaderGroups().map((headerGroup) =>
                headerGroup.headers.map((header) => {
                  // If column sizing is enabled, apply inline styles from TanStack (header.getSize()).
                  // Also respect minSize/maxSize from the ExtendedColumnDef if set.
                  const style: React.CSSProperties = {};
                  if (enableColumnSizing) {
                    const col = header.column.columnDef;
                    const size = header.getSize();
                    if (size) style.width = size + "px";
                    if (col.minSize) style.minWidth = col.minSize + "px";
                    if (col.maxSize) style.maxWidth = col.maxSize + "px";
                  }

                  return (
                    <TableHead
                      key={header.id}
                      className="text-left border"
                      style={style}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                    </TableHead>
                  );
                })
              )}
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
          {/* Main data rows */}
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

              {rows.map((rowData) => {
                const tanStackRow = table
                  .getRowModel()
                  .rows.find((r) => r.original === rowData);
                if (!tanStackRow) return null; // Data changed significantly?

                const rowId = tanStackRow.id;
                const rowIndex = tanStackRow.index;
                const disabled = isRowDisabled(disabledRows, groupKey, rowIndex);

                return (
                  <TableRow key={rowId} className={disabled ? "bg-muted" : ""}>
                    {tanStackRow
                      .getVisibleCells()
                      .map((cell) => {
                        const colDef = cell.column.columnDef as ExtendedColumnDef<T>;
                        const colKey = getColumnKey(colDef);

                        const isDisabled =
                          disabled || disabledColumns.includes(colKey);

                        const errorMsg =
                          cellErrors[groupKey]?.[rowId]?.[colKey] || null;

                        // If sizing is on, also apply styles in the cell 
                        const style: React.CSSProperties = {};
                        if (enableColumnSizing) {
                          const size = cell.column.getSize();
                          if (size) style.width = size + "px";
                          if (colDef.minSize) style.minWidth = colDef.minSize + "px";
                          if (colDef.maxSize) style.maxWidth = colDef.maxSize + "px";
                        }

                        return (
                          <TableCell
                            key={cell.id}
                            className={`border
                              ${isDisabled ? "bg-muted" : ""}
                              ${errorMsg ? "bg-destructive/25" : ""}
                            `}
                            style={style}
                            contentEditable={!isDisabled}
                            suppressContentEditableWarning
                            // Original content capture on focus
                            onFocus={(e) =>
                              handleCellFocus(e, groupKey, rowData, colDef)
                            }
                            // Let user do Ctrl+A, C, X, Z, V, etc.
                            onKeyDown={(e) => {
                              if (
                                (e.ctrlKey || e.metaKey) &&
                                ["a", "c", "x", "z", "v"].includes(
                                  e.key.toLowerCase()
                                )
                              ) {
                                return; // do not block
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
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        );
                      })}
                  </TableRow>
                );
              })}
            </React.Fragment>
          ))}
        </TableBody>

        {/* Render footer (totals row + custom footer) */}
        {renderFooter()}
      </Table>
    </div>
  );
}

export default SheetTable;