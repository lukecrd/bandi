import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

// Asse wdth: titoli e numeri allargati, testo a larghezza normale, con una sola famiglia.
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"] });

export const metadata: Metadata = {
  title: "BandiMatch",
  description: "Matching clienti, bandi e incentivi ufficiali",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" className={archivo.className}>
      <body>{children}</body>
    </html>
  );
}
