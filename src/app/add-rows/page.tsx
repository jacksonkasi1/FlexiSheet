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
 */
function updateNestedRow<K extends keyof RowData>(
  rows: RowData[],
  rowId: string,
  colKey: K,
  newValue: RowData[K],
): RowData[] {
  return rows.map((row) => {
    if (row.id === rowId) {
      return { ...row, [colKey]: newValue };
    }
    if (row.subRows && row.subRows.length > 0) {
      return {
        ...row,
        subRows: updateNestedRow(row.subRows, rowId, colKey, newValue),
      };
    }
    return row;
  });
}

/**
 * Recursively add a sub-row to a specific row in nested data.
 */
function addSubRow(rows: RowData[], parentId: string): RowData[] {
  return rows.map((row) => {
    if (row.id === parentId) {
      const newSubRow: RowData = {
        id: `${parentId}.${(row.subRows?.length || 0) + 1}`,
        materialName: "New Sub-Row",
        cft: 0,
        rate: 0,
        amount: 0,
      };
      return {
        ...row,
        subRows: [...(row.subRows || []), newSubRow],
      };
    }
    if (row.subRows) {
      return { ...row, subRows: addSubRow(row.subRows, parentId) };
    }
    return row;
  });
}

function addSubRowToRow(rows: RowData[], parentId: string): RowData[] {
  return rows.map((row) => {
    if (row.id === parentId) {
      const newSubRow: RowData = {
        id: `${parentId}.${(row.subRows?.length ?? 0) + 1}`,
        materialName: "New SubRow",
        cft: 0,
        rate: 0,
        amount: 0,
      };
      return {
        ...row,
        subRows: [...(row.subRows ?? []), newSubRow],
      };
    } else if (row.subRows) {
      return { ...row, subRows: addSubRowToRow(row.subRows, parentId) };
    }
    return row;
  });
}

function removeRowRecursively(rows: RowData[], rowId: string): RowData[] {
  return rows
    .filter((row) => row.id !== rowId) // remove the matched row
    .map((row) => {
      if (row.subRows) {
        return { ...row, subRows: removeRowRecursively(row.subRows, rowId) };
      }
      return row;
    });
}

/**
 * HomePage - shows how to integrate the SheetTable with dynamic row addition.
 */
export default function HomePage() {
  const [data, setData] = useState<RowData[]>(initialData);

  const handleEdit = <K extends keyof RowData>(
    rowId: string,
    columnId: K,
    value: RowData[K],
  ) => {
    setData((prevData) => updateNestedRow(prevData, rowId, columnId, value));
  };

  const handleSubmit = () => {
    const validateRows = (rows: RowData[]): boolean => {
      for (const row of rows) {
        const result = rowDataZodSchema.safeParse(row);
        if (!result.success) {
          console.error("Row validation failed:", result.error.issues, row);
          return false;
        }
        if (row.subRows) {
          if (!validateRows(row.subRows)) return false;
        }
      }
      return true;
    };

    if (validateRows(data)) {
      console.log("Table data is valid! Submitting:", data);
    } else {
      console.error("Table data is invalid.");
    }
  };

  const addRow = () => {
    const newRow: RowData = {
      id: `${data.length + 1}`,
      materialName: "New Row",
      cft: 0,
      rate: 0,
      amount: 0,
    };
    setData((prevData) => [...prevData, newRow]);
  };

    // Insert new sub-row under parent row
    const handleAddRowFunction = (parentId: string) => {
      console.log("Adding sub-row under row:", parentId);
      setData((old) => addSubRowToRow(old, parentId));
    };
  
    // Remove row (and its subRows) by rowId
    const handleRemoveRowFunction = (rowId: string) => {
      console.log("Removing row:", rowId);
      setData((old) => removeRowRecursively(old, rowId));
    };

  return (
    <div style={{ padding: "1rem" }}>
      <h1>Home Page with Dynamic Rows</h1>
      <div style={{ marginBottom: "1rem" }}>
        <Button onClick={addRow}>Add Main Row</Button>
      </div>
      <SheetTable<RowData>
        columns={columns}
        data={data}
        onEdit={handleEdit}
        enableColumnSizing
        rowActions={{ add: "left", remove: "left" }}
        handleAddRowFunction={handleAddRowFunction}
        handleRemoveRowFunction={handleRemoveRowFunction}

      />
      <div style={{ marginTop: "1rem" }}>
        <Button onClick={handleSubmit} style={{ marginLeft: "1rem" }}>
          Submit
        </Button>
      </div>
    </div>
  );
}
