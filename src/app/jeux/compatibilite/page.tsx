import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { GroupRoomBanner } from "@/components/group-room-banner";
import { getActiveLobbyForViewer } from "@/server/lobbies";
import { RoomJoin } from "@/games/geographie/components/geography-setup";
import { CompatibiliteSetup } from "@/games/compatibilite/components/compatibilite-setup";

export default async function CompatibilitePage() {
  const group = await getActiveLobbyForViewer();
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
            <p className="geo-hx-kicker">Même réponse ? · Compatibilité</p>
            <h1 className="geo-hx-title">
              Deux choix.<br />
              Un <span className="geo-hx-accent">point commun.</span>
            </h1>
            <p className="geo-hx-lede">
              Répondez chacun à votre rythme, puis découvrez ce qui vous rapproche — sans note psychologique, juste une partie légère à deux.
            </p>
            <div className="geo-hx-facts">
              <Fact title="2 à 4 choix" text="Des questions originales" />
              <Fact title="3 passes" text="Pour changer de question" />
              <Fact title="100 % coop" text="Aucun gagnant ni perdant" />
            </div>
          </section>
          <div className="geo-hx-actions"><CompatibiliteSetup groupRoomId={group?.roomId} />{group ? <GroupRoomBanner roomId={group.roomId} /> : <RoomJoin />}</div>
        </div>
      </div>
    </main>
  );
}

function Fact({ title, text }: { title: string; text: string }) {
  return <div className="geo-fact"><p>{title}</p><span>{text}</span></div>;
}
