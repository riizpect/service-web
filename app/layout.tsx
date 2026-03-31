import "./globals.css";
import type { ReactNode } from "react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ferno Serviceverktyg",
  description:
    "Internt verktyg för förebyggande underhåll och servicedokumentation av Ferno VIPER och VLS."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sv" className="h-full">
      <body className="min-h-screen bg-background text-foreground">
        <div className="min-h-screen flex flex-col">{children}</div>
      </body>
    </html>
  );
}

