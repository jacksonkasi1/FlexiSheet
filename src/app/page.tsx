"use client";

import React, { JSX, useState } from "react";
import SheetTable from "../components/SheetTable";
import { ColumnDef } from "@tanstack/react-table";

/**
 * Interface representing the structure of each row in the table.
 */
interface RowData {
  /**
   * Name of the material.
   */
  materialName: string;
  /**
   * Cubic feet measurement of the material.
   */
  cft: number;
  /**
   * Rate per cubic foot for the material.
   */
  rate: number;
  /**
   * Total amount for the material.
   */
  amount: number;
}

/**
 * Initial data for the table rows.
 */
const initialData: RowData[] = [
  { materialName: "Pine Wood", cft: 0.2215, rate: 560, amount: 124.04 },
  { materialName: "Rubber Wood", cft: 0.33917, rate: 1200, amount: 406.08 },
];

/**
 * Column definitions for the table.
 * Each column corresponds to a key in the RowData interface.
 */
const columns: ColumnDef<RowData>[] = [
  {
    accessorKey: "materialName", // Links this column to the "materialName" key in RowData
    header: "Material Name", // Column header text
  },
  {
    accessorKey: "cft", // Links this column to the "cft" key in RowData
    header: "CFT",
  },
  {
    accessorKey: "rate", // Links this column to the "rate" key in RowData
    header: "Rate",
  },
  {
    accessorKey: "amount", // Links this column to the "amount" key in RowData
    header: "Amount",
  },
];

/**
 * Configuration for disabling specific columns and rows.
 */
const disabledColumns: string[] = ["materialName"]; // Disable editing for the "materialName" column
const disabledRows: number[] = []; // No rows are disabled in this configuration

/**
 * Home page component rendering a dynamic sheet table with a submit button.
 * @returns {JSX.Element} The rendered Home page.
 */
export default function Home(): JSX.Element {
  /**
   * State to manage the table data.
   */
  const [data, setData] = useState(initialData);

  /**
   * Handles the editing of a cell in the table.
   * Updates the specific cell with the new value.
   * 
   * @template K - A key of RowData.
   * @param {number} rowIndex - Index of the row being edited.
   * @param {K} columnId - ID of the column being edited.
   * @param {RowData[K]} value - The new value to set in the cell.
   */
  const handleEdit = <K extends keyof RowData>(
    rowIndex: number,
    columnId: K,
    value: RowData[K]
  ) => {
    // Create a copy of the data array to avoid mutating the state directly
    const updatedData = [...data];

    // Check the type of the current cell and parse the value if it's a number
    updatedData[rowIndex][columnId] =
      typeof updatedData[rowIndex][columnId] === "number"
        ? (parseFloat(value as string) as RowData[K]) // Ensure the value is parsed as a number
        : value; // Otherwise, directly assign the value

    // Update the state with the modified data array
    setData(updatedData);
  };

  /**
   * Handles the submission of table data.
   * Logs the current state of the table to the console.
   */
  const handleSubmit = () => {
    console.log("Table Data Submitted:", data);
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Dynamic Sheet Table</h1>
      <SheetTable<RowData>
        columns={columns} // Pass the column definitions
        data={data} // Pass the table data
        onEdit={handleEdit} // Pass the cell edit handler
        disabledColumns={disabledColumns} // Disable specific columns
        disabledRows={disabledRows} // Disable specific rows
      />
      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Submit
      </button>
    </div>
  );
}
