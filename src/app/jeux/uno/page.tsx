import Image from "next/image";
import Link from "next/link";
import { SiteHeaderCached } from "@/components/site-header-cached";
import { GameRoomAside } from "@/components/game-room-aside";
import { RoomJoin } from "@/games/geographie/components/geography-setup";
import { UnoSetup } from "@/games/uno/components/uno-setup";

// Page vitrine mise en cache (régénérée au plus toutes les heures) : aucun
// appel serveur au rendu. Le salon actif est détecté côté client par
// `GameRoomAside` (`useActiveGroupRoom`), le compte par l'îlot `SiteHeaderAuth`.
export const revalidate = 3600;

export default function UnoPage() {
  return (
    <main className="geo-page game-landing">
      <div className="geo-hx-bg" aria-hidden="true">
        <Image src="/geographie/background.png" alt="" fill priority sizes="100vw" className="geo-hx-bg-image" />
      </div>
      <SiteHeaderCached variant="geo" />
      <div className="geo-hx-content">
        <Link href="/" className="geo-hx-back">← Tous les jeux</Link>
        <div className="geo-hx-layout">
          <section className="geo-hx-copy">
            <p className="geo-hx-kicker">Dernière carte · UNO</p>
            <h1 className="geo-hx-title">
              Pose tes cartes.<br />
              Garde <span className="geo-hx-accent">le rythme.</span>
            </h1>
            <p className="geo-hx-lede">
              Le UNO classique à deux, avec une table privée, un chrono serveur et une main adverse qui reste secrète jusqu&apos;à la fin.
            </p>
            <div className="geo-hx-facts">
              <Fact title="108 cartes" text="Le paquet complet" />
              <Fact title="7 chacun" text="Distribution classique" />
              <Fact title="+4 contrôlé" text="Sans contestation" />
            </div>
          </section>
          <div className="geo-hx-actions"><UnoSetup /><GameRoomAside fallback={<RoomJoin />} /></div>
        </div>
      </div>
    </main>
  );
}

function Fact({ title, text }: { title: string; text: string }) {
  return <div className="geo-fact"><p>{title}</p><span>{text}</span></div>;
}
