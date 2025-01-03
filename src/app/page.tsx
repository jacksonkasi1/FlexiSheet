/**
 * page.tsx
 *
 * Demonstration of using the extended SheetTable with Zod-based validation.
 */

"use client";

import React, { useState } from "react";
import { z } from "zod";

import SheetTable from "@/components/sheet-table";
import { ExtendedColumnDef } from "@/components/sheet-table/utils";

import { rowDataZodSchema, RowData } from "@/schemas/row-data-schema";

const materialNameSchema = rowDataZodSchema.shape.materialName; // required string
const cftSchema = rowDataZodSchema.shape.cft;                   // optional number >= 0
const rateSchema = rowDataZodSchema.shape.rate;                 // required number >= 0
const amountSchema = rowDataZodSchema.shape.amount;             // required number >= 0

/**
 * Initial data for demonstration.
 */
const initialData: RowData[] = [
  { materialName: "Pine Wood", cft: 0.2215, rate: 560, amount: 124.04 },
  { materialName: "Rubber Wood", cft: 0.33917, rate: 1200, amount: 406.08 },
];

/**
 * Extended column definitions, each with a validationSchema.
 * We rely on 'accessorKey' instead of 'id'. This is fine now 
 * because we manually allowed 'accessorKey?: string'.
 */
const columns: ExtendedColumnDef<RowData>[] = [
  {
    accessorKey: "materialName",
    header: "Material Name",
    validationSchema: materialNameSchema,
  },
  {
    accessorKey: "cft",
    header: "CFT",
    validationSchema: cftSchema,
  },
  {
    accessorKey: "rate",
    header: "Rate",
    validationSchema: rateSchema,
  },
  {
    accessorKey: "amount",
    header: "Amount",
    validationSchema: amountSchema,
  },
];

/**
 * HomePage - shows how to integrate the SheetTable with per-column Zod validation.
 */
export default function HomePage() {
  const [data, setData] = useState<RowData[]>(initialData);

  /**
   * onEdit callback: updates local state if the new value is valid.
   */
  const handleEdit = <K extends keyof RowData>(
    rowIndex: number,
    columnId: K,
    value: RowData[K]
  ) => {
    // Create a copy of data
    const newData = [...data];
    newData[rowIndex] = {
      ...newData[rowIndex],
      [columnId]: value,
    };
    setData(newData);

    console.log(`State updated [row=${rowIndex}, col=${String(columnId)}]:`, value);
  };

  /**
   * Validate entire table on submit.
   * If any row fails, we log the errors. Otherwise, we log the data.
   */
  const handleSubmit = () => {
    const arraySchema = z.array(rowDataZodSchema);
    const result = arraySchema.safeParse(data);

    if (!result.success) {
      console.error("Table data is invalid:", result.error.issues);
    } else {
      console.log("Table data is valid! Submitting:", data);
    }
  };

  return (
    <div style={{ padding: "1rem" }}>
      <h1 style={{ marginBottom: "1rem" }}>Home Page with Zod Validation</h1>

      <SheetTable<RowData>
        columns={columns}
        data={data}
        onEdit={handleEdit}
        disabledColumns={["materialName"]} // e.g. ["materialName"]
        disabledRows={[]}    // e.g. [1]
      />

      <button
        style={{
          marginTop: "1rem",
          padding: "0.5rem 1rem",
          backgroundColor: "#007bff",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
        }}
        onClick={handleSubmit}
      >
        Submit
      </button>
    </div>
  );
}
