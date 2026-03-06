import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lead Prospector - Lweb",
  description: "Herramienta de prospeccion local para Lweb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
