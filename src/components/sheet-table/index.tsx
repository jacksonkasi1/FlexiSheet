"use client";

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
 * - Hover-based Add/Remove row actions
 * - Custom styling for cells and columns
 * - Real-time validation with Zod schemas
 * - Keyboard shortcuts (Ctrl+Z, Ctrl+V, etc.)
 */

import React, { useState, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  flexRender,
  TableOptions,
  Row as TanStackRow,
  ColumnSizingState,
} from "@tanstack/react-table";

// ** import icons
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";

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
 * The main SheetTable component, now with optional column sizing support,
 * sub-row expansions, and hover-based Add/Remove row actions.
 */
function SheetTable<
  T extends {
    // Common properties for each row
    id?: string; // Each row should have a unique string/number ID
    headerKey?: string;
    subRows?: T[];
  },
>(props: SheetTableProps<T>) {
  const {
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

    // Add/Remove Dynamic Row Actions
    rowActions,
    handleAddRowFunction,
    handleRemoveRowFunction,
  } = props;

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
   * Track errors/original content keyed by (groupKey, rowId) for editing.
   */
  const [cellErrors, setCellErrors] = useState<
    Record<string, Record<string, Record<string, string | null>>>
  >({});
  const [cellOriginalContent, setCellOriginalContent] = useState<
    Record<string, Record<string, Record<string, string>>>
  >({});

  /**
   * Track the currently hovered row ID (or null if none).
   */
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

  /**
   * Build the final table options. Merge user-provided tableOptions with ours.
   */
  const mergedOptions: TableOptions<T> = {
    data,
    columns,
    getRowId: (row) => row.id ?? String(Math.random()), // fallback if row.id is missing
    getCoreRowModel: getCoreRowModel(),
    // Provide subRows if you have them:
    getSubRows: (row) => row.subRows ?? undefined,
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
   * Find a TanStack row by matching rowData.id.
   */
  const findTableRow = useCallback(
    (rowData: T): TanStackRow<T> | undefined => {
      if (!rowData.id) return undefined;
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
      e: React.FocusEvent<HTMLTableCellElement | HTMLDivElement>,
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
      e: React.FormEvent<HTMLTableCellElement | HTMLDivElement>,
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
   * OnBlur: if content changed from the original, parse/validate. If valid => onEdit(rowId, colKey, parsedValue).
   */
  const handleCellBlur = useCallback(
    (
      e: React.FocusEvent<HTMLTableCellElement | HTMLDivElement>,
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
      const originalValue =
        cellOriginalContent[groupKey]?.[rowId]?.[colKey] ?? "";

      if (rawValue === originalValue) {
        return; // No change
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
        console.error(`Row "${rowId}", Col "${colKey}" error: ${errorMessage}`);
      } else if (onEdit) {
        // Instead of rowIndex, we pass the row's unique ID from TanStack
        onEdit(rowId, colKey as keyof T, parsedValue as T[keyof T]);
      }
    },
    [disabledColumns, disabledRows, findTableRow, cellOriginalContent, onEdit],
  );

  /**
   * Group data by `headerKey` (top-level only).
   * Sub-rows are handled by TanStack expansions.
   */
  const groupedData = React.useMemo(() => {
    const out: Record<string, T[]> = {};
    data.forEach((row) => {
      const key = row.headerKey || "ungrouped";
      if (!out[key]) out[key] = [];
      out[key].push(row);
    });
    return out;
  }, [data]);

  /**
   * Attempt removing the row with the given rowId via handleRemoveRowFunction.
   * You can also do the "recursive removal" in your parent with a similar approach to `updateNestedRow`.
   */
  const removeRow = useCallback(
    (rowId: string) => {
      if (handleRemoveRowFunction) {
        handleRemoveRowFunction(rowId);
      }
    },
    [handleRemoveRowFunction],
  );

  /**
   * Attempt adding a sub-row to the row with given rowId (the "parentRowId").
   */
  const addSubRow = useCallback(
    (parentRowId: string) => {
      if (handleAddRowFunction) {
        handleAddRowFunction(parentRowId);
      }
    },
    [handleAddRowFunction],
  );

  // rowActions config
  const addPos = rowActions?.add ?? null; // "left" | "right" | null
  const removePos = rowActions?.remove ?? null; // "left" | "right" | null

  const rowActionCellStyle: React.CSSProperties = {
    width: "5px",
    maxWidth: "5px",
    outline: "none",
  };
  const rowActionCellClassName = "p-0 border-none bg-transparent";

  /**
   * Recursively renders a row and its sub-rows, handling:
   * - Row content and cell editing
   * - Hover-activated action icons (Add/Remove)
   * - Sub-row indentation and expansion
   * - Row-level error tracking and validation
   * - Disabled state management
   *
   * @param row - TanStack row instance containing the data and state
   * @param groupKey - Identifier for the row's group, used for validation and disabled state
   * @param level - Nesting depth (0 = top-level), used for sub-row indentation
   * @returns JSX element containing the row and its sub-rows
   */

  const renderRow = (row: TanStackRow<T>, groupKey: string, level = 0) => {
    const rowId = row.id;
    const rowIndex = row.index;
    const rowData = row.original;

    // Determine if this row or its group is disabled
    const disabled = isRowDisabled(disabledRows, groupKey, rowIndex);

    // TanStack expansion logic
    const hasSubRows = row.getCanExpand();
    const isExpanded = row.getIsExpanded();

    // Determine if we show the rowAction icons on hover
    const showRowActions = hoveredRowId === rowId; // only for hovered row

    return (
      <React.Fragment key={rowId}>
        <TableRow
          className={cn(
            "border-none", // it's will remove border for icons cells
            disabled ? "bg-muted" : "",
          )}
          // On mouse enter/leave, set hovered row
          onMouseEnter={() => setHoveredRowId(rowId)}
          onMouseLeave={() =>
            setHoveredRowId((prev) => (prev === rowId ? null : prev))
          }
        >
          {/* Left icon cells */}
          {addPos === "left" && handleAddRowFunction && (
            <TableCell
              className={cn(rowActionCellClassName)}
              style={rowActionCellStyle}
            >
              {showRowActions && (
                <button
                  className="flex items-center justify-center w-full"
                  onClick={() => addSubRow(rowId)}
                >
                  <Plus size={16} />
                </button>
              )}
            </TableCell>
          )}
          {removePos === "left" && handleRemoveRowFunction && (
            <TableCell
              className={cn(rowActionCellClassName)}
              style={rowActionCellStyle}
            >
              {showRowActions && (
                <button
                  className="flex items-center justify-center w-full"
                  onClick={() => removeRow(rowId)}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </TableCell>
          )}

          {/**
           * If the "Add" or "Remove" icons are on the left, we can render an extra <TableCell> for them,
           * or overlay them.
           * We'll do an approach that overlays them. For clarity, let's keep it simple:
           * we'll just overlay or absolutely position them, or place them in the first cell.
           */}
          {row.getVisibleCells().map((cell, cellIndex) => {
            const colDef = cell.column.columnDef as ExtendedColumnDef<T>;
            const colKey = getColumnKey(colDef);
            const isDisabled = disabled || disabledColumns.includes(colKey);
            const errorMsg = cellErrors[groupKey]?.[rowId]?.[colKey] || null;

            // Apply sizing logic & indentation
            const style: React.CSSProperties = {};
            if (enableColumnSizing) {
              const size = cell.column.getSize();
              if (size) style.width = `${size}px`;
              if (colDef.minSize) style.minWidth = `${colDef.minSize}px`;
              if (colDef.maxSize) style.maxWidth = `${colDef.maxSize}px`;
            }
            if (cellIndex === 0) {
              style.paddingLeft = `${level * 20}px`;
            }

            // Render cell content with customizations for the first cell
            const rawCellContent = flexRender(
              cell.column.columnDef.cell,
              cell.getContext(),
            );

            let cellContent: React.ReactNode = rawCellContent;

            // If first cell, show expand arrow if subRows exist
            if (cellIndex === 0) {
              cellContent = (
                <div
                  className="flex items-center gap-2 w-full h-full"
                  style={{ outline: "none" }} // Hide the focus outline
                >
                  {hasSubRows && (
                    <button
                      type="button"
                      className={cn("flex-shrink-0", {
                        "opacity-50 cursor-not-allowed": !hasSubRows,
                      })}
                      onClick={() => row.toggleExpanded()}
                      disabled={!hasSubRows}
                    >
                      {isExpanded ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      )}
                    </button>
                  )}
                  <div
                    className="flex-grow"
                    contentEditable={!isDisabled}
                    suppressContentEditableWarning
                    style={{ outline: "none" }} // Hide the outline for editing
                    onFocus={(e) =>
                      handleCellFocus(e, groupKey, rowData, colDef)
                    }
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
                    onBlur={(e) => handleCellBlur(e, groupKey, rowData, colDef)}
                  >
                    {rawCellContent}
                  </div>
                </div>
              );
            }

            return (
              <TableCell
                key={cell.id}
                className={cn(
                  "border relative", // 'relative' for absolute icons if you prefer
                  {
                    "bg-muted": isDisabled,
                    "bg-destructive/25": errorMsg,
                  },
                  typeof colDef.className === "function"
                    ? colDef.className(rowData)
                    : colDef.className,
                )}
                style={style}
                contentEditable={cellIndex === 0 ? false : !isDisabled}
                suppressContentEditableWarning
                onFocus={(e) => {
                  if (cellIndex > 0 && !isDisabled) {
                    handleCellFocus(e, groupKey, rowData, colDef);
                  }
                }}
                onKeyDown={(e) => {
                  if (cellIndex > 0 && !isDisabled) {
                    if (
                      (e.ctrlKey || e.metaKey) &&
                      // Let user do Ctrl+A, C, X, Z, V, etc.
                      ["a", "c", "x", "z", "v"].includes(e.key.toLowerCase())
                    ) {
                      return; // do not block copy/paste
                    }
                    handleKeyDown(e, colDef);
                  }
                }}
                onPaste={(e) => {
                  if (cellIndex > 0 && !isDisabled) {
                    handlePaste(e, colDef);
                  }
                }}
                onInput={(e) => {
                  if (cellIndex > 0 && !isDisabled) {
                    handleCellInput(e, groupKey, rowData, colDef);
                  }
                }}
                onBlur={(e) => {
                  if (cellIndex > 0 && !isDisabled) {
                    handleCellBlur(e, groupKey, rowData, colDef);
                  }
                }}
              >
                {/** The actual content */}
                {cellContent}
              </TableCell>
            );
          })}

          {/* Right icon cells */}
          {addPos === "right" && handleAddRowFunction && (
            <TableCell
              className={cn(rowActionCellClassName)}
              style={rowActionCellStyle}
            >
              {showRowActions && (
                <button
                  className="flex items-center justify-center w-full"
                  onClick={() => addSubRow(rowId)}
                >
                  <Plus size={16} />
                </button>
              )}
            </TableCell>
          )}

          {removePos === "right" && handleRemoveRowFunction && (
            <TableCell
              className={cn(rowActionCellClassName)}
              style={rowActionCellStyle}
            >
              {showRowActions && (
                <button
                  className="flex items-center justify-center w-full"
                  onClick={() => removeRow(rowId)}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </TableCell>
          )}
        </TableRow>

        {/* If expanded, render each subRows recursively */}
        {isExpanded &&
          row.subRows.map((subRow) => renderRow(subRow, groupKey, level + 1))}
      </React.Fragment>
    );
  };

  /**
   * Renders optional footer (totals row + optional custom element) inside a <TableFooter>.
   */
  function renderFooter() {
    if (!totalRowValues && !footerElement) return null;

    return (
      <TableFooter className="border-none">
        {/* If there's a totalRowTitle, show it in a single row */}
        {totalRowTitle && (
          <TableRow className="border-none">
            {/* Right icon - empty cells  */}
            {addPos === "left" && (
              <TableCell
                className={cn(rowActionCellClassName)}
                style={rowActionCellStyle}
              />
            )}

            {removePos === "left" && (
              <TableCell
                className={cn(rowActionCellClassName)}
                style={rowActionCellStyle}
              />
            )}

            <TableCell
              colSpan={columns.length}
              className="border text-center font-semibold"
            >
              {totalRowTitle}
            </TableCell>

            {/* Left icon - empty cells  */}
            {addPos === "right" && (
              <TableCell
                className={cn(rowActionCellClassName)}
                style={rowActionCellStyle}
              />
            )}

            {removePos === "right" && (
              <TableCell
                className={cn(rowActionCellClassName)}
                style={rowActionCellStyle}
              />
            )}
          </TableRow>
        )}

        {/* The totals row */}
        {totalRowValues && (
          <TableRow className="border-none">
            {/*  Right icon - empty cells  */}
            {addPos === "left" && (
              <TableCell
                className={cn(rowActionCellClassName)}
                style={rowActionCellStyle}
              />
            )}

            {removePos === "left" && (
              <TableCell
                className={cn(rowActionCellClassName)}
                style={rowActionCellStyle}
              />
            )}

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
            <TableRow className="border-none">
              {/* Right icon cells empty headers */}
              {addPos === "left" && (
                <TableHead
                  className={cn(rowActionCellClassName)}
                  style={rowActionCellStyle}
                />
              )}

              {removePos === "left" && (
                <TableHead
                  className={cn(rowActionCellClassName)}
                  style={rowActionCellStyle}
                />
              )}

              {table.getHeaderGroups().map((headerGroup) =>
                headerGroup.headers.map((header) => {
                  const style: React.CSSProperties = {};
                  if (enableColumnSizing) {
                    const col = header.column.columnDef;
                    const size = header.getSize();
                    if (size) style.width = `${size}px`;
                    if (col.minSize) style.minWidth = `${col.minSize}px`;
                    if (col.maxSize) style.maxWidth = `${col.maxSize}px`;
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

              {/* Left icon cells empty headers */}

              {addPos === "right" && (
                <TableHead
                  className={cn(rowActionCellClassName)}
                  style={rowActionCellStyle}
                />
              )}

              {removePos === "right" && (
                <TableHead
                  className={cn(rowActionCellClassName)}
                  style={rowActionCellStyle}
                />
              )}
            </TableRow>
          </TableHeader>
        )}
        {/* Optional second header */}{" "}
        {showSecondHeader && secondHeaderTitle && (
          <TableRow>

            {/* Right icon cells empty headers */}
            {addPos === "left" && (
              <TableCell
                className={cn(rowActionCellClassName)}
                style={rowActionCellStyle}
              />
            )}

            {removePos === "left" && (
              <TableCell
                className={cn(rowActionCellClassName)}
                style={rowActionCellStyle}
              />
            )}

            <TableHead colSpan={columns.length} className="text-center border">
              {secondHeaderTitle}
            </TableHead>

            {/* Left icon cells empty headers */}
            {addPos === "right" && (
              <TableCell
                className={cn(rowActionCellClassName)}
                style={rowActionCellStyle}
              />
            )}

            {removePos === "right" && (
              <TableCell
                className={cn(rowActionCellClassName)}
                style={rowActionCellStyle}
              />
            )}

          </TableRow>
        )}
        <TableBody>
          {Object.entries(groupedData).map(([groupKey, topRows]) => (
            <React.Fragment key={groupKey}>
              {/* Group label row (if not ungrouped) */}
              {groupKey !== "ungrouped" && (
                <TableRow className="border-none">

                {/* Right icon cells empty headers */}
                {addPos === "left" && (
                  <TableCell
                    className={cn(rowActionCellClassName)}
                    style={rowActionCellStyle}
                  />
                )}

                {removePos === "left" && (
                  <TableCell
                    className={cn(rowActionCellClassName)}
                    style={rowActionCellStyle}
                    />
                )}

                  <TableCell
                    colSpan={columns.length}
                    className="font-bold bg-muted-foreground/10 border"
                  >
                    {groupKey}
                  </TableCell>

                  {/* Left icon cells empty headers */}
                  {addPos === "right" && (
                    <TableCell
                      className={cn(rowActionCellClassName)}
                      style={rowActionCellStyle}
                    />
                  )}

                  {removePos === "right" && (
                    <TableCell
                      className={cn(rowActionCellClassName)}
                      style={rowActionCellStyle}
                    />
                  )}

                </TableRow>
              )}
              {/* For each top-level row in this group, find the actual row in table.
                  Then recursively render it with renderRow() */}{" "}
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
