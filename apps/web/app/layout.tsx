import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { Masthead } from "./components/Chrome";
import "./globals.css";

const sans = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: "ResearchX",
  description: "Citation-grounded answers from an open-access Ethiopian health corpus.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="font-sans antialiased">
        <Masthead />
        <main>{children}</main>
      </body>
    </html>
  );
}
