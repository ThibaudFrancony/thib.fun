import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { GroupRoomBanner } from "@/components/group-room-banner";
import { getActiveLobbyForViewer } from "@/server/lobbies";
import { TrouNoirRoomJoin, TrouNoirSetup } from "@/games/trou-noir/components/trou-noir-setup";

export default async function TrouNoirSetupPage() {
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
            <p className="geo-hx-kicker">Chute libre · Trou Noir</p>
            <h1 className="geo-hx-title">
              Réponds juste.<br />
              Évite la <span className="geo-hx-accent">chute.</span>
            </h1>
            <p className="geo-hx-lede">
              100 points de réserve, −10 par mauvaise réponse. Même nombre de tours pour chacun, questions appariées
              par niveau, correction automatique et contestation tranchée par ton adversaire.
            </p>
            <div className="geo-hx-facts">
              <Fact title="2 joueurs" text="Un lien de salon privé" />
              <Fact title="5 ou 10" text="Manches au choix" />
              <Fact title="5 catégories" text="Niveaux 3 à 6" />
            </div>
          </section>
          <div className="geo-hx-actions"><TrouNoirSetup groupRoomId={group?.roomId} />{group ? <GroupRoomBanner roomId={group.roomId} /> : <TrouNoirRoomJoin />}</div>
        </div>
      </div>
    </main>
  );
}

function Fact({ title, text }: { title: string; text: string }) {
  return <div className="geo-fact"><p>{title}</p><span>{text}</span></div>;
}
