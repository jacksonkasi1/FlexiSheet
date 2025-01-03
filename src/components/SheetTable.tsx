import React, { useState } from "react";
import {
  useReactTable,
  ColumnDef,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";

interface SheetTableProps<T> {
  columns: ColumnDef<T, any>[];

  data: T[];

  onEdit?: <K extends keyof T>(
    rowIndex: number,
    columnId: K,
    value: T[K],
  ) => void;
}

function SheetTable<T extends object>({
  columns,
  data,
  onEdit,
}: SheetTableProps<T>) {
  const [tableData, setTableData] = useState(data);
  const [disabledColumns, setDisabledColumns] = useState<string[]>([]);
  const [disabledRows, setDisabledRows] = useState<number[]>([]);

  const toggleColumn = (columnId: string) => {
    setDisabledColumns((prev) =>
      prev.includes(columnId)
        ? prev.filter((id) => id !== columnId)
        : [...prev, columnId],
    );
  };

  const toggleRow = (rowIndex: number) => {
    setDisabledRows((prev) =>
      prev.includes(rowIndex)
        ? prev.filter((index) => index !== rowIndex)
        : [...prev, rowIndex],
    );
  };

  const handleCellEdit = (rowIndex: number, columnId: keyof T, value: any) => {
    if (disabledRows.includes(rowIndex) || disabledColumns.includes(columnId as string))
      return;
    const updatedData = [...tableData];
    (updatedData[rowIndex] as any)[columnId] = value;
    setTableData(updatedData);
    if (onEdit) onEdit(rowIndex, columnId, value);
  };

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="p-4">
      {/* Column Toggle Controls */}
      <div className="flex gap-4 mb-4">
        {columns.map((col, index) => (
          <button
            key={`${col.id}-${index}`}
            onClick={() => toggleColumn(col.id!)}
            className={`px-4 py-2 rounded ${
              disabledColumns.includes(col.id!)
                ? "bg-red-500 text-white"
                : "bg-green-500 text-white"
            }`}
          >
            {disabledColumns.includes(col.id!)
              ? `Enable ${col.id}`
              : `Disable ${col.id}`}
          </button>
        ))}
      </div>

      <table className="table-auto w-full border-collapse border border-gray-200">
        <thead className="bg-gray-100">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="border border-gray-300 px-4 py-2 text-left"
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
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
                    disabledColumns.includes(cell.column.id)
                      ? "bg-gray-200"
                      : ""
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
                      e.currentTarget.textContent,
                    )
                  }
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
              {/* Row Toggle */}
              <td>
                <button
                  onClick={() => toggleRow(row.index)}
                  className={`px-2 py-1 rounded ${
                    disabledRows.includes(row.index)
                      ? "bg-red-500 text-white"
                      : "bg-green-500 text-white"
                  }`}
                >
                  {disabledRows.includes(row.index)
                    ? "Enable Row"
                    : "Disable Row"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default SheetTable;
