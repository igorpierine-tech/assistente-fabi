import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Raízes e Riquezas",
  description: "Agenda, clientes e assistente inteligente da Raízes e Riquezas",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
