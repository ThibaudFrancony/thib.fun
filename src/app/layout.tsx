import type { Metadata } from "next";
import { Fredoka } from "next/font/google";
import { ChatDock } from "@/components/chat/chat-dock";
import "./globals.css";
import "./game-tables.css";
import "./match-screen.css";
import "./motion.css";

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

// Pas de `force-dynamic` ici : il désactiverait le cache de route pour tout
// le site. Les pages privées déclarent leur propre `force-dynamic` ; les
// coquilles publiques (`/`, `/jeux/*`, `/connexion`, `/entrainement`) sont
// statiques et lisent la session via l'îlot client `SiteHeaderAuth`.

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
