'use client';
import SheetTable from "@/components/sheet-table"
import { ExtendedColumnDef } from "@/components/sheet-table/utils"

type MyData = {
  headerKey?: string
  id: string
  materialName: string
  quantity: number
  cost: number
}

const columns: ExtendedColumnDef<MyData>[] = [
  {
    header: "Material Name",
    accessorKey: "materialName",
    size: 120,
    minSize: 100,
    maxSize: 300,
  },
  {
    header: "Quantity",
    accessorKey: "quantity",
    size: 80,
    minSize: 50,
    maxSize: 120,
  },
  {
    header: "Cost",
    accessorKey: "cost",
    size: 100,
  },
]

const data: MyData[] = [
  { id: "1", materialName: "Pine Wood", quantity: 5, cost: 100 },
  { id: "2", materialName: "Rubber Wood", quantity: 3, cost: 75 },
  // ...
]

export default function MyPage() {
  return (
    <SheetTable
      columns={columns}
      data={data}
      enableColumnSizing
      tableOptions={{
        columnResizeMode: "onChange",
        // e.g., if you wanted to set an initialState or something else:
        initialState: { columnVisibility: { cost: false } },
      }}
      totalRowValues={{ quantity: 8, cost: 175 }}
      totalRowLabel="Total"
      totalRowTitle="Summary"
    />
  )
}
