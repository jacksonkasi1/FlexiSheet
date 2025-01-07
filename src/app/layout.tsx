import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import Header from "@/components/header";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FlexiSheet - Reusable and Editable Tables",
  description:
    "Discover FlexiSheet: A dynamic, reusable table component with features like editable cells, row disabling, Zod validation, and more.",
  keywords:
    "FlexiSheet, React Table, Editable Cells, Zod Validation, Dynamic Tables, Reusable Components",
  authors: [{ name: "Jackson Kasi", url: "https://github.com/jacksonkasi1" }],
  openGraph: {
    title: "FlexiSheet - Reusable and Editable Tables",
    description:
      "FlexiSheet provides advanced table features for React, including grouping, validation, and customization.",
    url: "https://flexisheet.vercel.app/",
    siteName: "FlexiSheet",
    images: [
      {
        url: "https://flexisheet.vercel.app/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "FlexiSheet - Reusable and Editable Tables",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FlexiSheet - Reusable and Editable Tables",
    description:
      "Discover FlexiSheet: A dynamic, reusable table component for React applications.",
    images: ["https://flexisheet.vercel.app/og-image.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Header />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
