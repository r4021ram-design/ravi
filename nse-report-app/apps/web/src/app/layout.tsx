import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NSE Daily Report | Pre-Market & Post-Market Intelligence",
  description:
    "Real-time NSE trading terminal delivering daily pre-market and post-market reports with options analytics, FII/DII flows, and India VIX analysis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-svh bg-[#050810] text-gray-100 font-(family-name:--font-inter) antialiased flex flex-col overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
