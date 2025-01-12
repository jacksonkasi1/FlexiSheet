/**
 * sheet-table/index.tsx
 *
 * A reusable table component with editable cells, row/column disabling,
 * custom data support, and Zod validation. Supports:
 *  - Grouping rows by a `headerKey`
 *  - A configurable footer (totals row + custom element)
 *  - TanStack Table column sizing (size, minSize, maxSize)
 *  - Forwarding other TanStack Table configuration via tableOptions
 *  - Sub-rows (nested rows) with expand/collapse
 */

import React, { useState, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel, // <-- For expansions
  flexRender,
  TableOptions,
  Row as TanStackRow,
  ColumnSizingState,
} from "@tanstack/react-table";

// ** import icons
import { ChevronDown, ChevronRight } from "lucide-react";

// ** import ui components
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

// ** import utils
import {
  ExtendedColumnDef,
  SheetTableProps,
  parseAndValidate,
  getColumnKey,
  handleKeyDown,
  handlePaste,
  isRowDisabled,
} from "./utils";

// ** import lib
import { cn } from "@/lib/utils";

/**
 * The main SheetTable component, now with optional column sizing support
 * and sub-row expansions.
 */
function SheetTable<
  T extends Record<string, unknown> & {
    // Common properties for each row
    id?: string | number;
    headerKey?: string;
    subRows?: T[];
  },
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
}: SheetTableProps<T>) {
  /**
   * If column sizing is enabled, we track sizes in state.
   * This allows the user to define 'size', 'minSize', 'maxSize' in the column definitions.
   */
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});

  /**
   * Expanded state for sub-rows. Keyed by row.id in TanStack Table.
   */
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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
    // Basic row model
    getRowId: (row) => row.id, // Use the 'id' property as the row ID
    getCoreRowModel: getCoreRowModel(),
    // Provide subRows if you have them:
    getSubRows: (row) => (row.subRows ? row.subRows : undefined),
    // Add expansions
    getExpandedRowModel: getExpandedRowModel(),
    enableExpanding: true,

    // External expanded state
    state: {
      // If user also provided tableOptions.state, merge them
      ...(tableOptions.state ?? {}),
      expanded,
      ...(enableColumnSizing
        ? {
            columnSizing,
          }
        : {}),
    },
    onExpandedChange: setExpanded, // keep expansions in local state

    // If sizing is enabled, pass sizing states:
    ...(enableColumnSizing
      ? {
          onColumnSizingChange: setColumnSizing,
          columnResizeMode: tableOptions.columnResizeMode ?? "onChange",
        }
      : {}),

    // Spread any other user-provided table options
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
      // NOTE: Because we have expansions, rowData might be in subRows.
      // We can do a quick flatten search across all rows. We use table.getRowModel().flatRows
      return table
        .getRowModel()
        .flatRows.find((r) => r.original.id === rowData.id);
    },
    [table],
  );

  /**
   * Store a cell's original value on focus, for detecting changes on blur.
   */
  const handleCellFocus = useCallback(
    (
      e: React.FocusEvent<HTMLTableCellElement>,
      groupKey: string,
      rowData: T,
      colDef: ExtendedColumnDef<T>,
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
        return {
          ...prev,
          [groupKey]: { ...groupContent, [rowId]: rowContent },
        };
      });
    },
    [findTableRow],
  );

  /**
   * Real-time validation on each keystroke (but no onEdit call here).
   */
  const handleCellInput = useCallback(
    (
      e: React.FormEvent<HTMLTableCellElement>,
      groupKey: string,
      rowData: T,
      colDef: ExtendedColumnDef<T>,
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
        const rowErrors = {
          ...(groupErrors[rowId] || {}),
          [colKey]: errorMessage,
        };
        return { ...prev, [groupKey]: { ...groupErrors, [rowId]: rowErrors } };
      });
    },
    [disabledColumns, disabledRows, findTableRow],
  );

  /**
   * OnBlur: if content changed from the original, parse/validate. If valid => onEdit.
   */
  const handleCellBlur = useCallback(
    (
      e: React.FocusEvent<HTMLTableCellElement>,
      groupKey: string,
      rowData: T,
      colDef: ExtendedColumnDef<T>,
    ) => {
      const tanStackRow = findTableRow(rowData);
      if (!tanStackRow) return;

      const rowId = tanStackRow.id; // <--- Use rowId to
      const colKey = getColumnKey(colDef);

      if (
        isRowDisabled(disabledRows, groupKey, tanStackRow.index) ||
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
        const rowErrors = {
          ...(groupErrors[rowId] || {}),
          [colKey]: errorMessage,
        };
        return { ...prev, [groupKey]: { ...groupErrors, [rowId]: rowErrors } };
      });

      if (errorMessage) {
        console.error(
          `Group "${groupKey}", Row "${rowId}", Col "${colKey}" final error: ${errorMessage}`,
        );
      } else if (onEdit) {
        // Instead of rowIndex, we pass the row's unique ID from TanStack
        onEdit(rowId, colKey as keyof T, parsedValue as T[keyof T]);
      }
    },
    [disabledColumns, disabledRows, findTableRow, cellOriginalContent, onEdit],
  );

  /**
   * Group data by the `headerKey` field (top-level only).
   * Sub-rows are handled by TanStack expansions.
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
   * A recursive function to render a row (and any sub-rows) in the table body.
   * We respect existing logic for editing, disabling, error highlighting, etc.
   *
   * @param row - The TanStack row to render
   * @param groupKey - The group name (for row disabling + error tracking)
   * @param level - The nesting level (0 = top-level). We can indent sub-rows if desired.
   */
  const renderRow = (row: TanStackRow<T>, groupKey: string, level = 0) => {
    const rowId = row.id;
    const rowIndex = row.index;
    const rowData = row.original;
    const disabled = isRowDisabled(disabledRows, groupKey, rowIndex);

    // We'll build a <TableRow> for the "parent" row, then if row is expanded,
    // we recursively render subRows below it.
    // Indent the first cell or add a toggle arrow if row has subRows.

    const hasSubRows = row.getCanExpand(); // true if subRows exist
    const isExpanded = row.getIsExpanded();

    return (
      <React.Fragment key={rowId}>
        <TableRow className={disabled ? "bg-muted" : ""}>
          {row.getVisibleCells().map((cell, cellIndex) => {
            const colDef = cell.column.columnDef as ExtendedColumnDef<T>;
            const colKey = getColumnKey(colDef);

            const isDisabled = disabled || disabledColumns.includes(colKey);
            const errorMsg = cellErrors[groupKey]?.[rowId]?.[colKey] || null;

            // Column sizing style
            const style: React.CSSProperties = {};
            if (enableColumnSizing) {
              const size = cell.column.getSize();
              if (size) style.width = size + "px";
              if (colDef.minSize) style.minWidth = colDef.minSize + "px";
              if (colDef.maxSize) style.maxWidth = colDef.maxSize + "px";
            }

            // For the first cell, we place the expand/collapse toggle if subRows exist.
            let cellContent = flexRender(
              cell.column.columnDef.cell,
              cell.getContext(),
            );
            if (cellIndex === 0 && hasSubRows) {
              cellContent = (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => row.toggleExpanded()}
                  >
                    {/* Expand/collapse arrow */}
                    {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </button>
                  {cellContent}
                </div>
              );
            }

            // Optional indentation for subRows
            // e.g. style={{ marginLeft: level * 20 }} or a left padding class
            // We'll do a small inline style here for demonstration:
            const indentStyle: React.CSSProperties = {
              paddingLeft: level * 20,
            };

            return (
              <TableCell
                key={cell.id}
                className={cn(
                  "border",
                  {
                    "bg-muted": isDisabled,
                    "bg-destructive/25": errorMsg,
                  },
                  typeof colDef.className === "function"
                    ? colDef.className(rowData)
                    : colDef.className,
                )}
                style={{ ...colDef.style, ...style, ...indentStyle }}
                contentEditable={!isDisabled}
                suppressContentEditableWarning
                onFocus={(e) => handleCellFocus(e, groupKey, rowData, colDef)}
                onKeyDown={(e) => {
                  if (
                    (e.ctrlKey || e.metaKey) &&
                    // Let user do Ctrl+A, C, X, Z, V, etc.
                    ["a", "c", "x", "z", "v"].includes(e.key.toLowerCase())
                  ) {
                    return; // do not block copy/paste
                  }
                  handleKeyDown(e, colDef);
                }}
                onPaste={(e) => handlePaste(e, colDef)}
                onInput={(e) => handleCellInput(e, groupKey, rowData, colDef)}
                onBlur={(e) => handleCellBlur(e, groupKey, rowData, colDef)}
              >
                {cellContent}
              </TableCell>
            );
          })}
        </TableRow>

        {/* If expanded, render each subRow recursively */}
        {isExpanded &&
          row.subRows.map((subRow) => renderRow(subRow, groupKey, level + 1))}
      </React.Fragment>
    );
  };

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

              // Always apply the border to the first cell or any cell that has a displayValue
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
        <TableCaption>
          Dynamic, editable data table with grouping & nested sub-rows.
        </TableCaption>

        {/* Primary header */}
        {showHeader && (
          <TableHeader>
            <TableRow>
              {table.getHeaderGroups().map((headerGroup) =>
                headerGroup.headers.map((header) => {
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
                        header.getContext(),
                      )}
                    </TableHead>
                  );
                }),
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
          {Object.entries(groupedData).map(([groupKey, topRows]) => (
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

              {/* For each top-level row in this group, find the actual row in table. 
                  Then recursively render it with renderRow() */}
              {topRows.map((rowData) => {
                const row = table
                  .getRowModel()
                  .flatRows.find((r) => r.original === rowData);
                if (!row) return null;

                return renderRow(row, groupKey, 0);
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
