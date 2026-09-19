import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { GameRoomAside } from "@/components/game-room-aside";
import { getActiveRoomForViewer } from "@/server/lobbies";
import { RoomJoin } from "@/games/geographie/components/geography-setup";
import { SkyjoSetup } from "@/games/skyjo/components/skyjo-setup";

export default async function SkyjoPage() {
  const group = await getActiveRoomForViewer();
  return (
    <main className="geo-page game-landing">
      <div className="geo-hx-bg" aria-hidden="true">
        <Image src="/geographie/background.png" alt="" fill priority sizes="100vw" className="geo-hx-bg-image" />
      </div>
      <SiteHeader variant="geo" />
      <div className="geo-hx-content">
        <Link href="/" className="geo-hx-back">← Tous les jeux</Link>
        <div className="geo-hx-layout">
          <section className="geo-hx-copy">
            <p className="geo-hx-kicker">Douze cases · Skyjo</p>
            <h1 className="geo-hx-title">
              Douze cases.<br />
              Le plus petit <span className="geo-hx-accent">total gagne.</span>
            </h1>
            <p className="geo-hx-lede">
              Révèle, échange et fais disparaître tes colonnes. Le premier qui finit offre un dernier tour à son adversaire.
            </p>
            <div className="geo-hx-facts">
              <Fact title="150 cartes" text="De -2 à 12" />
              <Fact title="3 manches" text="En format rapide" />
              <Fact title="Dernier tour" text="Après chaque fin" />
            </div>
          </section>
          <div className="geo-hx-actions"><SkyjoSetup groupRoomId={group?.roomId} /><GameRoomAside groupRoomId={group?.roomId} fallback={<RoomJoin />} /></div>
        </div>
      </div>
    </main>
  );
}

function Fact({ title, text }: { title: string; text: string }) {
  return <div className="geo-fact"><p>{title}</p><span>{text}</span></div>;
}
