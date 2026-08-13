import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Assistente da Fabi — Raízes e Riquezas",
  description: "Assistente pessoal de agenda da Fabiana",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
