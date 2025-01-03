"use client";

import React, { useState } from "react";
import SheetTable from "../components/SheetTable";
import { ColumnDef } from "@tanstack/react-table";

interface RowData {
  materialName: string;
  cft: number;
  rate: number;
  amount: number;
}

const initialData: RowData[] = [
  { materialName: "Pine Wood", cft: 0.2215, rate: 560, amount: 124.04 },
  { materialName: "Rubber Wood", cft: 0.33917, rate: 1200, amount: 406.08 },
];

const columns: ColumnDef<RowData>[] = [
  {
    accessorKey: "materialName",
    header: "Material Name",
  },
  {
    accessorKey: "cft",
    header: "CFT",
  },
  {
    accessorKey: "rate",
    header: "Rate",
  },
  {
    accessorKey: "amount",
    header: "Amount",
  },
];

export default function Home() {
  const [data, setData] = useState(initialData);



  const handleEdit = <K extends keyof RowData>(
    rowIndex: number,
    columnId: K,
    value: RowData[K],
  ) => {
    const updatedData = [...data];

    updatedData[rowIndex][columnId] =
      typeof updatedData[rowIndex][columnId] === "number"
        ? (parseFloat(value as string) as RowData[K])
        : value;

    setData(updatedData);
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Dynamic Sheet Table</h1>
      <SheetTable<RowData> columns={columns} data={data} onEdit={handleEdit} />
    </div>
  );
}
