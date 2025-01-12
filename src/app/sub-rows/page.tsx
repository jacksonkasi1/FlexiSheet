"use client";

import React, { useState } from "react";

// ** import ui components
import { Button } from "@/components/ui/button";

// ** import component
import SheetTable from "@/components/sheet-table";
import { ExtendedColumnDef } from "@/components/sheet-table/utils";

// ** import zod schema for row data
import { rowDataZodSchema, RowData } from "@/schemas/row-data-schema";

const materialNameSchema = rowDataZodSchema.shape.materialName; // required string
const cftSchema = rowDataZodSchema.shape.cft;                   // optional number >= 0
const rateSchema = rowDataZodSchema.shape.rate;                 // required number >= 0
const amountSchema = rowDataZodSchema.shape.amount;             // required number >= 0

/**
 * Initial data for demonstration.
 * All `id` values must be *unique strings* across all nested subRows.
 */
const initialData: RowData[] = [
  {
    id: "1",
    materialName: "Ultra Nitro Sealer",
    cft: 0.03,
    rate: 164,
    amount: 5.17,
  },
  {
    id: "2",
    materialName: "NC Thinner (Spl)",
    cft: 0.202,
    rate: 93,
    amount: 19.73,
    subRows: [
      {
        id: "2.1",
        materialName: "NC Thinner (Spl) 1",
        cft: 0.203,
        rate: 94,
        amount: 20.0,
      },
      {
        id: "2.2",
        materialName: "NC Thinner (Spl) 2",
        cft: 0.204,
        rate: 95,
        amount: 20.3,
      },
    ],
  },
  {
    id: "3",
    materialName: "Ultra Nitro Sealer 2",
    cft: 0.072,
    rate: 165,
    amount: 12.4,
  },
  {
    id: "4",
    materialName: "Ultra Nitro Matt 2",
    cft: 0.051,
    rate: 209,
    amount: 11.19,
    subRows: [
      {
        id: "4.1",
        materialName: "Ultra Nitro Matt 2 1",
        cft: 0.052,
        rate: 210,
        amount: 11.2,
        subRows: [
          {
            id: "4.1.1",
            materialName: "Ultra Nitro Matt 2 1 1",
            cft: 0.053,
            rate: 211,
            amount: 11.3,
          },
          {
            id: "4.1.2",
            materialName: "Ultra Nitro Matt 2 1 2",
            cft: 0.054,
            rate: 212,
            amount: 11.4,
          },
        ],
      },
      {
        id: "4.2",
        materialName: "Ultra Nitro Matt 2 2",
        cft: 0.055,
        rate: 213,
        amount: 11.5,
      },
    ],
  },
  {
    id: "5",
    materialName: "Ultra Nitro Glossy 2",
    cft: 0.045,
    rate: 215,
    amount: 9.68,
  },
];

/**
 * Extended column definitions, each with a validationSchema.
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
 * Recursively update a row in nested data by matching rowId with strict equality.
 * Logs when it finds a match, so we can see exactly what's updated.
 */
function updateNestedRow<K extends keyof RowData>(
  rows: RowData[],
  rowId: string,
  colKey: K,
  newValue: RowData[K],
): RowData[] {
  return rows.map((row) => {
    // If this row's ID matches rowId exactly, update it
    if (row.id === rowId) {
      console.log("updateNestedRow -> Found exact match:", rowId);
      return { ...row, [colKey]: newValue };
    }

    // Otherwise, if the row has subRows, recurse
    if (row.subRows && row.subRows.length > 0) {
      // We only log if we are actually diving into them
      console.log("updateNestedRow -> Checking subRows for row:", row.id);
      return {
        ...row,
        subRows: updateNestedRow(row.subRows, rowId, colKey, newValue),
      };
    }

    // If no match and no subRows, return row unchanged
    return row;
  });
}

/**
 * HomePage - shows how to integrate the SheetTable with per-column Zod validation.
 */
export default function HomePage() {
  const [data, setData] = useState<RowData[]>(initialData);

  /**
   * onEdit callback: updates local state if the new value is valid.
   */
  const handleEdit = <K extends keyof RowData>(
    rowId: string, // Unique identifier for the row
    columnId: K,   // Column key
    value: RowData[K], // New value for the cell
  ) => {
    setData((prevData) => {
      const newRows = updateNestedRow(prevData, rowId, columnId, value);
      // optional logging
      console.log(
        `State updated [row id=${rowId}, column=${columnId}, value=${value}]`
      );
      return newRows;
    });
  };

  /**
   * Validate entire table (including subRows) on submit.
   */
  const handleSubmit = () => {
    const validateRows = (rows: RowData[]): boolean => {
      for (const row of rows) {
        // Validate this row
        const result = rowDataZodSchema.safeParse(row);
        if (!result.success) {
          console.error("Row validation failed:", result.error.issues, row);
          return false;
        }
        // Recursively validate subRows if present
        if (row.subRows && row.subRows.length > 0) {
          if (!validateRows(row.subRows)) return false;
        }
      }
      return true;
    };

    if (validateRows(data)) {
      console.log("Table data is valid! Submitting:", data);
    } else {
      console.error("Table data is invalid. Check the logged errors.");
    }
  };

  return (
    <div style={{ padding: "1rem" }}>
      <h1 style={{ marginBottom: "1rem" }}>Home Page with Zod Validation</h1>

      <SheetTable<RowData>
        columns={columns}
        data={data}
        onEdit={handleEdit}
        // e.g. disable editing materialName column
        disabledColumns={["materialName"]}
        disabledRows={[2]}
        showHeader={true}
        showSecondHeader={true}
        secondHeaderTitle="Custom Title Example"
        enableColumnSizing
      />

      <Button onClick={handleSubmit}>Submit</Button>
    </div>
  );
}