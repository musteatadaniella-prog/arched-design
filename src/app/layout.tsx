import type { Metadata } from "next";
import { Antonio, Inter, JetBrains_Mono } from "next/font/google";
import { LangProvider } from "@/lib/i18n";
import "./globals.css";

const antonio = Antonio({ variable: "--font-antonio", subsets: ["latin", "latin-ext"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: "ARCHED design — Proiectare arhitecturală și de rezistență",
  description:
    "ARCHED design: arhitectură și inginerie structurală într-o singură echipă, de la concept până la autorizația de construire.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ro">
      <body className={`${antonio.variable} ${inter.variable} ${mono.variable} antialiased`}>
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
