import type { Metadata } from "next";
import "./globals.css";
import { ClientProviders } from "@/components/client-providers";

export const metadata: Metadata = {
  title: "TabTrad",
  description: "Biblioteca de músicas para ensaio de dança"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
