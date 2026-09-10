import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "tibo.fun — jeux à deux",
  description: "Une table privée de jeux à deux, en français.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
