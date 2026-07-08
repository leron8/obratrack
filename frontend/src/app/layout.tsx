import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ObraTrack",
  description: "Panel de gestion de construccion y control financiero",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
