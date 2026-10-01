import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Raízes e Riquezas — Assistente de Agenda",
  description: "Gestão de agendamentos, clientes e assistente inteligente para profissionais de estética e bem-estar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="google-site-verification" content="7ADX7f4owFHQz2k5gBn-iOL3iVwVX_BsbhiklF6XN4s" />
      </head>
      <body>{children}</body>
    </html>
  );
}
