import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Seceurope Platform",
  description: "Manager and guard tablet web surfaces for ABIOT RFID access control",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
