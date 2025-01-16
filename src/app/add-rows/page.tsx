"use client";

import React, { useState } from "react";
import { nanoid } from "nanoid";

// ** import ui components
import { Button } from "@/components/ui/button";

// ** import your reusable table
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
 * We can still provide some initial IDs manually, but they must be unique.
 */
const initialData: RowData[] = [
  {
    headerKey: "Group 1",
    id: "1",
    materialName: "Ultra Nitro Sealer",
    cft: 0.03,
    rate: 164,
    amount: 5.17
  },
  {
    headerKey: "Group 1",
    id: "2",
    materialName: "NC Thinner (Spl)",
    cft: 0.202,
    rate: 93,
    amount: 101.73,
  },
  {
    headerKey: "Group 2",
    id: "row-1",
    materialName: "Ultra Nitro Sealer",
    cft: 0.03,
    rate: 164,
    amount: 5.17,
  },
  {
    headerKey: "Group 2",
    id: "row-2",
    materialName: "NC Thinner (Spl)",
    cft: 0.202,
    rate: 93,
    amount: 19.73,
    subRows: [
      {
        id: "row-2.1",
        materialName: "NC Thinner (Spl) 1",
        cft: 0.203,
        rate: 94,
        amount: 20.0,
      },
      {
        id: "row-2.2",
        materialName: "NC Thinner (Spl) 2",
        cft: 0.204,
        rate: 95,
        amount: 20.3,
      },
    ],
  },
  {
    id: "row-3",
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
 * Recursively update a row in nested data by matching rowId.
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
    if (row.subRows?.length) {
      return {
        ...row,
        subRows: updateNestedRow(row.subRows, rowId, colKey, newValue),
      };
    }
    return row;
  });
}

/**
 * Recursively add a sub-row under a given parent (by rowId).
 * Always generate a brand-new ID via nanoid().
 */
function addSubRowToRow(rows: RowData[], parentId: string): RowData[] {
  return rows.map((row) => {
    if (row.id === parentId) {
      const newSubRow: RowData = {
        id: nanoid(), // <-- Generate a guaranteed unique ID
        materialName: "New SubRow",
        cft: 0,
        rate: 0,
        amount: 0,
      };
      return {
        ...row,
        subRows: [...(row.subRows ?? []), newSubRow],
      };
    } else if (row.subRows?.length) {
      return { ...row, subRows: addSubRowToRow(row.subRows, parentId) };
    }
    return row;
  });
}

/**
 * Remove the row with the given rowId, recursively if in subRows.
 */
function removeRowRecursively(rows: RowData[], rowId: string): RowData[] {
  return rows
    .filter((row) => row.id !== rowId)
    .map((row) => {
      if (row.subRows?.length) {
        return { ...row, subRows: removeRowRecursively(row.subRows, rowId) };
      }
      return row;
    });
}

/**
 * HomePage - shows how to integrate the SheetTable with dynamic row addition,
 * guaranteed unique IDs, sub-row removal, and validation on submit.
 */
export default function HomePage() {
  const [data, setData] = useState<RowData[]>(initialData);

  /**
   * onEdit callback: updates local state if the new value is valid.
   */
  const handleEdit = <K extends keyof RowData>(
    rowId: string,
    columnId: K,
    value: RowData[K],
  ) => {
    setData((prevData) => updateNestedRow(prevData, rowId, columnId, value));
  };

  /**
   * Validate entire table on submit.
   */
  const handleSubmit = () => {
    const validateRows = (rows: RowData[]): boolean => {
      for (const row of rows) {
        const result = rowDataZodSchema.safeParse(row);
        if (!result.success) {
          console.error("Row validation failed:", result.error.issues, row);
          return false;
        }
        if (row.subRows?.length) {
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

  /**
   * Add a brand-new main row (non-sub-row).
   * Also generate a unique ID for it via nanoid().
   */
  const addMainRow = () => {
    const newRow: RowData = {
      id: nanoid(), // Unique ID
      materialName: "New Row",
      cft: 0,
      rate: 0,
      amount: 0,
    };
    setData((prev) => [...prev, newRow]);
  };

  /**
   * Add a sub-row to a row with the given rowId.
   */
  const handleAddRowFunction = (parentId: string) => {
    console.log("Adding sub-row under row:", parentId);
    setData((old) => addSubRowToRow(old, parentId));
  };

  /**
   * Remove row (and subRows) by rowId.
   */
  const handleRemoveRowFunction = (rowId: string) => {
    console.log("Removing row:", rowId);
    setData((old) => removeRowRecursively(old, rowId));
  };

  return (
    <div style={{ padding: "1rem" }}>
      <h1>Home Page with Dynamic Rows & Unique IDs</h1>

      <div style={{ marginBottom: "1rem" }}>
        <Button onClick={addMainRow}>Add Main Row</Button>
      </div>

      <SheetTable<RowData>
        columns={columns}
        data={data}
        onEdit={handleEdit}
        enableColumnSizing
        // Show both icons on the "left"
        rowActions={{ add: "left", remove: "right" }}
        handleAddRowFunction={handleAddRowFunction}
        handleRemoveRowFunction={handleRemoveRowFunction}
        secondHeaderTitle="Custom Title Example"
        totalRowTitle="Total"
        totalRowValues={{
          materialName: "Total",
          cft: data.reduce((sum, row) => sum + (row.cft || 0), 0),
          rate: data.reduce((sum, row) => sum + row.rate, 0),
          amount: data.reduce((sum, row) => sum + row.amount, 0),
        }}
      />

      <div style={{ marginTop: "1rem" }}>
        <Button onClick={handleSubmit} style={{ marginLeft: "1rem" }}>
          Submit
        </Button>
      </div>
    </div>
  );
}