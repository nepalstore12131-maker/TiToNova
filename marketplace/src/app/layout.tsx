import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Titonova — Work and talent, connected in Nepal",
  description:
    "A Nepal-focused marketplace connecting independent professionals with employers.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
