import React from "react";
import {
  useReactTable,
  ColumnDef,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";

interface SheetTableProps<T> {
  columns: ColumnDef<T, any>[];
  data: T[];
  onEdit?: <K extends keyof T>(rowIndex: number, columnId: K, value: T[K]) => void;
  disabledColumns?: string[]; // Array of column IDs to disable
  disabledRows?: number[]; // Array of row indexes to disable
}

function SheetTable<T extends object>({
  columns,
  data,
  onEdit,
  disabledColumns = [],
  disabledRows = [],
}: SheetTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleCellEdit = (rowIndex: number, columnId: keyof T, value: any) => {
    if (disabledRows.includes(rowIndex) || disabledColumns.includes(columnId as string)) {
      return; // Skip if row or column is disabled
    }

    if (onEdit) onEdit(rowIndex, columnId, value);
  };

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
              className={`${
                disabledRows.includes(row.index) ? "bg-gray-300" : ""
              }`}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className={`border border-gray-300 px-4 py-2 ${
                    disabledColumns.includes(cell.column.id) ? "bg-gray-200" : ""
                  }`}
                  contentEditable={
                    !disabledRows.includes(row.index) &&
                    !disabledColumns.includes(cell.column.id)
                  }
                  suppressContentEditableWarning
                  onBlur={(e) =>
                    handleCellEdit(
                      row.index,
                      cell.column.id as keyof T,
                      e.currentTarget.textContent
                    )
                  }
                >
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
