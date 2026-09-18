import type { Metadata } from "next";
import { Fredoka } from "next/font/google";
import { ChatDock } from "@/components/chat/chat-dock";
import "./globals.css";

const displayFont = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "tibo.fun — jeux à deux",
  description: "Une table privée de jeux à deux, en français.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={displayFont.variable}>
      <body>
        {children}
        <ChatDock />
      </body>
    </html>
  );
}
