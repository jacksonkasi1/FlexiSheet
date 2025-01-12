/**
 * normal/page.tsx
 *
 * Demonstration of using the extended SheetTable with Zod-based validation.
 */

"use client";

import React, { useState } from "react";

// ** import 3rd party lib
import { z } from "zod";

// ** import ui components
import { Button } from "@/components/ui/button";

// ** import components
import SheetTable from "@/components/sheet-table";
import { ExtendedColumnDef } from "@/components/sheet-table/utils";

// ** import zod schema for row data
import { rowDataZodSchema, RowData } from "@/schemas/row-data-schema";

const materialNameSchema = rowDataZodSchema.shape.materialName; // required string
const cftSchema = rowDataZodSchema.shape.cft; // optional number >= 0
const rateSchema = rowDataZodSchema.shape.rate; // required number >= 0
const amountSchema = rowDataZodSchema.shape.amount; // required number >= 0

/**
 * Initial data for demonstration.
 */
const initialData: RowData[] = [
  { materialName: "Ultra Nitro Sealer", cft: 0.03, rate: 164, amount: 5.17 },
  {
    materialName: "NC Thinner (Spl)",
    cft: 0.202,
    rate: 93,
    amount: 19.73,
    subRows: [
      {
        materialName: "NC Thinner (Spl) 1",
        cft: 0.202,
        rate: 93,
        amount: 19.73,
      },
      {
        materialName: "NC Thinner (Spl) 2",
        cft: 0.202,
        rate: 93,
        amount: 19.73,
      },
    ],
  },
  { materialName: "Ultra Nitro Sealer 2", cft: 0.072, rate: 164, amount: 12.4 },
  {
    materialName: "Ultra Nitro Matt 2",
    cft: 0.051,
    rate: 209,
    amount: 11.19,
    subRows: [
      {
        materialName: "Ultra Nitro Matt 2 1",
        cft: 0.051,
        rate: 209,
        amount: 11.19,
      },
      {
        materialName: "Ultra Nitro Matt 2 2",
        cft: 0.051,
        rate: 209,
        amount: 11.19,
      },
    ],
  },
  { materialName: "Ultra Nitro Glossy 2", cft: 0.045, rate: 215, amount: 9.68 },
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
    size: 120,
    minSize: 50,
    maxSize: 100,
  },
  {
    accessorKey: "cft",
    header: "CFT",
    validationSchema: cftSchema,
    maxSize: 20,
  },
  {
    accessorKey: "rate",
    header: "Rate",
    validationSchema: rateSchema,
    size: 80,
    minSize: 50,
    maxSize: 120,
  },
  {
    accessorKey: "amount",
    header: "Amount",
    validationSchema: amountSchema,
    size: 80,
    minSize: 50,
    maxSize: 120,
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
    value: RowData[K],
  ) => {
    // Create a copy of data
    const newData = [...data];
    newData[rowIndex] = { ...newData[rowIndex], [columnId]: value };
    setData(newData);

    console.log(
      `State updated [row=${rowIndex}, col=${String(columnId)}]:`,
      value,
    );
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
        disabledRows={[2]}
        showHeader={true} // First header visibility
        showSecondHeader={true} // Second header visibility
        secondHeaderTitle="Custom Title Example" // Title for the second header
        enableColumnSizing
      />

      <Button onClick={handleSubmit}>Submit</Button>
    </div>
  );
}
