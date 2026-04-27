import type { Metadata } from "next";
import "@fontsource/newsreader/index.css";
import "@fontsource/open-sans/index.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portfolio — Assemblage ingénierie",
  description: "Références projets Assemblage ingénierie",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
