import Image from "next/image";
import Link from "next/link";
import { SiteHeaderCached } from "@/components/site-header-cached";
import { GameRoomAside } from "@/components/game-room-aside";
import { GeographySetup, RoomJoin } from "@/games/geographie/components/geography-setup";

// Page vitrine mise en cache (régénérée au plus toutes les heures) : aucun
// appel serveur au rendu. Le salon actif est détecté côté client par
// `GameRoomAside` (`useActiveGroupRoom`), le compte par l'îlot `SiteHeaderAuth`.
export const revalidate = 3600;

export default function GeographySetupPage() {
  return (
    <main className="geo-page geo-hexapoint">
      <div className="geo-hx-bg" aria-hidden="true">
        <Image src="/geographie/background.png" alt="" fill priority sizes="100vw" className="geo-hx-bg-image" />
      </div>
      <SiteHeaderCached variant="geo" />
      <div className="geo-hx-content">
        <Link href="/" className="geo-hx-back">← Tous les jeux</Link>
        <div className="geo-hx-layout">
          <section className="geo-hx-copy">
            <p className="geo-hx-kicker">HexaPoint · Géographie</p>
            <h1 className="geo-hx-title">
              La ville est là.<br />
              À toi de <span className="geo-hx-accent">viser juste.</span>
            </h1>
            <p className="geo-hx-lede">
              Deux placements par manche, une carte sans étiquette et un score qui récompense la précision. Les
              coordonnées ne partent qu&apos;après ta confirmation.
            </p>
            <div className="geo-hx-facts">
              <Fact title="2 joueurs" text="Un lien de salon privé" />
              <Fact title="5 à 15" text="Manches au choix" />
              <Fact title="France" text="Métropole + Corse" />
            </div>
          </section>
          <div className="geo-hx-actions">
            <GeographySetup />
            <GameRoomAside fallback={<RoomJoin />} />
          </div>
        </div>
      </div>
    </main>
  );
}

function Fact({ title, text }: { title: string; text: string }) {
  return <div className="geo-fact"><p>{title}</p><span>{text}</span></div>;
}
