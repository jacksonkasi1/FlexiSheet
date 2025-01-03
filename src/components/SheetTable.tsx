import React from "react";
import {
  useReactTable,
  ColumnDef,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";

/**
 * Props for the SheetTable component.
 * @template T - The type of data used in the table.
 */
interface SheetTableProps<T> {
  /**
   * Array of column definitions for the table.
   */
  columns: ColumnDef<T, any>[];

  /**
   * Array of data rows for the table.
   */
  data: T[];

  /**
   * Callback function triggered when a cell is edited.
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
 * A reusable table component with editable cells, row/column disabling, and custom data support.
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
  // Create the table instance using TanStack Table
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  /**
   * Handles editing of a cell.
   * @param {number} rowIndex - The index of the row being edited.
   * @param {keyof T} columnId - The ID of the column being edited.
   * @param {any} value - The new value entered in the cell.
   */
  const handleCellEdit = (rowIndex: number, columnId: keyof T, value: any) => {
    // Skip editing if the row or column is disabled
    if (disabledRows.includes(rowIndex) || disabledColumns.includes(columnId as string)) {
      return;
    }

    // Trigger the onEdit callback if provided
    if (onEdit) onEdit(rowIndex, columnId, value);
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
                  {/* Render column headers */}
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
              // Apply a gray background for disabled rows
              className={`${disabledRows.includes(row.index) ? "bg-gray-300" : ""}`}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  // Apply a lighter background for disabled columns
                  className={`border border-gray-300 px-4 py-2 ${
                    disabledColumns.includes(cell.column.id) ? "bg-gray-200" : ""
                  }`}
                  // Make the cell content editable only if the row and column are enabled
                  contentEditable={
                    !disabledRows.includes(row.index) &&
                    !disabledColumns.includes(cell.column.id)
                  }
                  suppressContentEditableWarning
                  // Handle blur event to save cell edits
                  onBlur={(e) =>
                    handleCellEdit(
                      row.index,
                      cell.column.id as keyof T,
                      e.currentTarget.textContent
                    )
                  }
                >
                  {/* Render the cell content */}
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default SheetTable;