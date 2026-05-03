import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

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
    <html lang="en" className={`${inter.variable} dark`} suppressHydrationWarning>
      <body className="h-screen overflow-hidden bg-[#050810] text-gray-100 font-(family-name:--font-inter) antialiased flex flex-col">
        {children}
      </body>
    </html>
  );
}
