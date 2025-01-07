# FlexiSheet

**FlexiSheet** is a powerful, reusable table component for React applications. It supports features like editable cells, row/column disabling, Zod-based validation, grouping rows by headers, and configurable footers.

---

## Features

- **Editable Cells**: Supports real-time editing with validation.
- **Zod Validation**: Per-column validation using Zod schemas.
- **Row/Column Disabling**: Disable specific rows or columns.
- **Grouping Rows**: Group data using a `headerKey` field.
- **Footer Support**: Add totals rows and custom footer elements.

---

## Table of Contents
1. [Features](#features)
2. [Demo](#demo)
3. [Installation](#installation)
4. [Basic Usage](#basic-usage)
5. [Advanced Options](#advanced-options)
6. [Development](#development)

## DEMO

**Link**: <https://flexisheet.vercel.app/>

![FlexiSheet Demo](https://flexisheet.vercel.app/og-image.png)

## Installation

### Prerequisites

Ensure you have the following installed in your project:

1. **Zod** for validation:

   ```bash
   bun install zod
   ```

2. **TanStack Table** for table functionality:

   ```bash
   bun install @tanstack/react-table
   ```

3. **ShadCN/UI** for UI components:

   - <https://ui.shadcn.com/docs/installation/next>

   ```bash
   bunx --bun shadcn@latest add table
   ```

4. **Tailwind CSS** for styling:

   ```bash
   bun install tailwindcss postcss autoprefix
   ```

---

## Basic Usage

Here is a minimal example of how to use **FlexiSheet**:

### 1. Define Your Data

```ts
const initialData = [
  { materialName: "Material A", cft: 0.1, rate: 100, amount: 10 },
  { materialName: "Material B", cft: 0.2, rate: 200, amount: 40 },
];
```

### 2. Define Column Schema with Validation

```ts
import { z } from "zod";

const materialNameSchema = z.string().min(1, "Required");
const cftSchema = z.number().nonnegative().optional();
const rateSchema = z.number().min(0, "Must be >= 0");
const amountSchema = z.number().min(0, "Must be >= 0");

const columns = [
  {
    accessorKey: "materialName",
    header: "Material Name",
    validationSchema: materialNameSchema,
  },
  { accessorKey: "cft", header: "CFT", validationSchema: cftSchema },
  { accessorKey: "rate", header: "Rate", validationSchema: rateSchema },
  { accessorKey: "amount", header: "Amount", validationSchema: amountSchema },
];
```

### 3. Render the Table

```tsx
import React, { useState } from "react";
import SheetTable from "./components/sheet-table";

const App = () => {
  const [data, setData] = useState(initialData);

  const handleEdit = (rowIndex, columnId, value) => {
    const newData = [...data];
    newData[rowIndex] = { ...newData[rowIndex], [columnId]: value };
    setData(newData);
  };

  return (
    <SheetTable
      columns={columns}
      data={data}
      onEdit={handleEdit}
      disabledColumns={["amount"]} // Example: Disable editing for "amount" col
      showHeader={true}
    />
  );
};

export default App;
```

---

## Advanced Options

### Grouped Rows Example

```ts
const groupedData = [
  {
    headerKey: "Group A",
    materialName: "Material A",
    cft: 0.1,
    rate: 100,
    amount: 10,
  },
  {
    headerKey: "Group A",
    materialName: "Material B",
    cft: 0.2,
    rate: 200,
    amount: 40,
  },
  {
    headerKey: "Group B",
    materialName: "Material C",
    cft: 0.3,
    rate: 300,
    amount: 90,
  },
];
```

### Group Specific Disabled Rows

```tsx
<SheetTable
  columns={columns}
  data={groupedData}
  disabledColumns={["materialName"]}
  disabledRows={{
    "Dipping - 2 times": [0], // Disable the second row in this group
    Spraying: [1], // Disable the first row in this group
  }}
/>
```

### Footer Example

```tsx
<SheetTable
  columns={columns}
  data={data}
  totalRowValues={{ cft: 0.6, rate: 600, amount: 140 }}
  totalRowLabel="Total"
  totalRowTitle="Summary"
  footerElement={<div>Custom Footer Content</div>}
/>
```

---

## Development

1. Clone the repository:

   ```bash
   git clone https://github.com/jacksonkasi1/FlexiSheet.git
   ```

2. Install dependencies:

   ```bash
   bun install
   ```

3. Run the development server:

   ```bash
   bun dev
   ```

---

## License

This project is licensed under the MIT License. See the LICENSE file for details.