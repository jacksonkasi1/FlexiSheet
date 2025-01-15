"use client";

import React, { useState } from "react";

// ** import ui components
import { Button } from "@/components/ui/button";

// ** import component
import SheetTable from "@/components/sheet-table";
import { ExtendedColumnDef } from "@/components/sheet-table/utils";

// ** import zod schema for row data
import { rowDataZodSchema, RowData } from "@/schemas/row-data-schema";

const materialNameSchema = rowDataZodSchema.shape.materialName;
const cftSchema = rowDataZodSchema.shape.cft;
const rateSchema = rowDataZodSchema.shape.rate;
const amountSchema = rowDataZodSchema.shape.amount;

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

const columns: ExtendedColumnDef<RowData>[] = [
  { accessorKey: "materialName", header: "Material Name", validationSchema: materialNameSchema },
  { accessorKey: "cft", header: "CFT", validationSchema: cftSchema },
  { accessorKey: "rate", header: "Rate", validationSchema: rateSchema },
  { accessorKey: "amount", header: "Amount", validationSchema: amountSchema },
];

function updateNestedRow<K extends keyof RowData>(
  rows: RowData[],
  rowId: string,
  colKey: K,
  newValue: RowData[K]
): RowData[] {
  return rows.map((row) => {
    if (row.id === rowId) {
      return { ...row, [colKey]: newValue };
    }
    if (row.subRows) {
      return { ...row, subRows: updateNestedRow(row.subRows, rowId, colKey, newValue) };
    }
    return row;
  });
}

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
      return { ...row, subRows: [...(row.subRows || []), newSubRow] };
    }
    if (row.subRows) {
      return { ...row, subRows: addSubRow(row.subRows, parentId) };
    }
    return row;
  });
}

export default function HomePage() {
  const [data, setData] = useState<RowData[]>(initialData);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  const handleEdit = <K extends keyof RowData>(
    rowId: string,
    columnId: K,
    value: RowData[K]
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

  const addSubRowToRow = () => {
    if (selectedRowId) {
      setData((prevData) => addSubRow(prevData, selectedRowId));
    }
  };

  const handleRowSelect = (rowId: string) => {
    setSelectedRowId(rowId);
  };

  return (
    <div style={{ padding: "1rem" }}>
      <h1>Dynamic Rows with Sub-Row Context</h1>
      <div style={{ marginBottom: "1rem" }}>
        <Button onClick={addRow}>Add Main Row</Button>
      </div>
      <SheetTable<RowData>
        columns={columns}
        data={data}
        onEdit={handleEdit}
        enableColumnSizing
        onCellFocus={(rowId) => handleRowSelect(rowId)} // Custom cell focus handler
      />
      {selectedRowId && (
        <div style={{ marginTop: "1rem" }}>
          <Button onClick={addSubRowToRow}>Add Sub-Row to Selected Row</Button>
          <Button onClick={handleSubmit} style={{ marginLeft: "1rem" }}>
            Submit
          </Button>
        </div>
      )}
    </div>
  );
}