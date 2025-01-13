# FlexiSheet

**FlexiSheet** is a powerful, reusable table component for React applications. It supports features like editable cells, row/column disabling, Zod-based validation, grouping rows by headers, and configurable footers.

---

## Table of Contents

1. [Features](#features)
2. [Demo](#demo)
3. [Installation](#installation)
   - [Prerequisites](#prerequisites)
4. [Basic Usage](#basic-usage)
   - [Define Your Data](#1-define-your-data)
   - [Define Column Schema with Validation](#2-define-column-schema-with-validation)
   - [Render the Table](#3-render-the-table)
5. [Advanced Options](#advanced-options)
   - [Grouped Rows Example](#grouped-rows-example)
   - [Group Specific Disabled Rows](#group-specific-disabled-rows)
   - [Footer Example](#footer-example)
6. [FAQ](#faq)
7. [Development](#development)
8. [License](#license)

---

## Features

- **Editable Cells**: Supports real-time editing with validation.
- **Zod Validation**: Per-column validation using Zod schemas.
- **Row/Column Disabling**: Disable specific rows or columns.
- **Grouping Rows**: Group data using a `headerKey` field.
- **Footer Support**: Add totals rows and custom footer elements.

---

## Demo

**Link**: <https://flexisheet.vercel.app/>

![FlexiSheet Demo](https://flexisheet.vercel.app/og-image.png)

---

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
   bun install tailwindcss postcss autoprefixer
   ```

---

## Basic Usage

### 1. Define Your Data

**👀 NOTE:** The `id` field is required for each row. It should be unique for each row.

```ts
const initialData = [
  { id: 1, materialName: "Material A", cft: 0.1, rate: 100, amount: 10 },
  { id: 2, materialName: "Material B", cft: 0.2, rate: 200, amount: 40 },
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
  { accessorKey: "materialName", header: "Material Name", validationSchema: materialNameSchema },
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

  /**
   * onEdit callback: updates local state if the new value is valid. (Normal usage)
   */
  const handleEdit = <K extends keyof RowData>(
    rowId: string, // Unique identifier for the row
    columnId: K, // Column key
    value: RowData[K], // New value for the cell
  ) => {
    setData((prevData) =>
      prevData.map(
        (row) =>
          String(row.id) === rowId
            ? { ...row, [columnId]: value } // Update the row if the ID matches
            : row, // Otherwise, return the row unchanged
      ),
    );

    console.log(
      `State updated [row id=${rowId}, column=${columnId}, value=${value}]`,
      value,
    );
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
    id: 1,
    headerKey: "Group A",
    materialName: "Material A",
    cft: 0.1,
    rate: 100,
    amount: 10,
  },
  {
    id: 2,
    headerKey: "Group A",
    materialName: "Material B",
    cft: 0.2,
    rate: 200,
    amount: 40,
  },
  {
    id: 3,
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

## FAQ

### **1. How do I disable editing for specific columns or rows?**

You can disable specific rows and columns by using the `disabledColumns` and `disabledRows` props in the `SheetTable` component.

- **Disable Columns**:

  ```tsx
  <SheetTable
    disabledColumns={["amount", "rate"]} // Disable editing for "amount" and "rate" columns
  />
  ```

- **Disable Rows(normal)**:

  ```tsx
  <SheetTable
    disabledRows={[0, 1]} // Disable the 1st & 2nd row
  />
  ```

- **Disable Rows(group)**:
  ```tsx
  <SheetTable
    disabledRows={{
      "Group A": [0], // Disable the first row in Group A
      "Group B": [1], // Disable the second row in Group B
    }}
  />
  ```

---

### **2. Can I add custom validation for columns?**

Yes, you can use **Zod schemas** to define validation rules for each column using the `validationSchema` property.

Example:

```ts
const rateSchema = z.number().min(0, "Rate must be greater than or equal to 0");
const columns = [
  {
    accessorKey: "rate",
    header: "Rate",
    validationSchema: rateSchema,
  },
];
```

---

### **3. What happens if validation fails?**

If validation fails while editing a cell, the cell will:

- Display an error class (e.g., `bg-destructive/25` by default).
- Not trigger the `onEdit` callback until the value is valid.

---

### **4. How do I group rows?**

To group rows, provide a `headerKey` field in your data and the `SheetTable` will automatically group rows based on this key.

Example:

```ts
const groupedData = [
  { headerKey: "Group A", materialName: "Material A", cft: 0.1 },
  { headerKey: "Group B", materialName: "Material B", cft: 0.2 },
];
```

---

### **5. Can I dynamically resize columns?**

Yes, you can enable column resizing by setting `enableColumnSizing` to `true` and providing column size properties (`size`, `minSize`, and `maxSize`) in the column definitions.

Example:

```tsx
const columns = [
  {
    accessorKey: "materialName",
    header: "Material Name",
    size: 200,
    minSize: 100,
    maxSize: 300,
  },
];
<SheetTable columns={columns} enableColumnSizing={true} />;
```

---

### **6. How do I add a footer with totals or custom elements?**

Use the `totalRowValues`, `totalRowLabel`, and `footerElement` props to define footer content.

Example:

```tsx
<SheetTable
  totalRowValues={{ cft: 0.6, rate: 600, amount: 140 }}
  totalRowLabel="Total"
  footerElement={<div>Custom Footer Content</div>}
/>
```

---

### **7. Does FlexiSheet support large datasets?**

Yes, but for optimal performance:

- Use **memoization** for `columns` and `data` to prevent unnecessary re-renders.
- Consider integrating virtualization (e.g., `react-window`) for very large datasets.

---

### **8. Can I hide columns dynamically?**

Yes, you can control column visibility using the `tableOptions.initialState.columnVisibility` configuration.

Example:

```tsx
<SheetTable
  tableOptions={{
    initialState: { columnVisibility: { amount: false } }, // Hide "amount" column
  }}
/>
```

---

### **9. How do I handle user actions like copy/paste or undo?**

FlexiSheet supports common keyboard actions like copy (`Ctrl+C`), paste (`Ctrl+V`), and undo (`Ctrl+Z`). You don’t need to configure anything to enable these actions.

---

### **10. How do I validate the entire table before submission?**

Use Zod's `array` schema to validate the entire dataset on form submission.

Example:

```tsx
const handleSubmit = () => {
  const tableSchema = z.array(rowDataZodSchema);
  const result = tableSchema.safeParse(data);
  if (!result.success) {
    console.error("Invalid data:", result.error.issues);
  } else {
    console.log("Valid data:", data);
  }
};
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
