import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { TrouNoirRoomJoin, TrouNoirSetup } from "@/games/trou-noir/components/trou-noir-setup";

export default function TrouNoirSetupPage() {
  return (
    <main className="geo-page geo-setup-page">
      <SiteHeader variant="geo" />
      <div className="geo-content geo-setup-content">
        <Link href="/" className="geo-back-link">← Tous les jeux</Link>
        <div className="geo-setup-layout">
          <section className="geo-hero-copy">
            <p className="geo-kicker">Chute libre · Trou Noir</p>
            <h1 className="geo-hero-title">Réponds juste pour éviter la chute.</h1>
            <p className="geo-hero-lede">
              100 points de réserve, −10 par mauvaise réponse. Même nombre de tours pour chacun, questions appariées
              par niveau, correction automatique et contestation tranchée par ton adversaire.
            </p>
            <div className="geo-facts">
              <Fact title="2 joueurs" text="Un lien de salon privé" />
              <Fact title="5 ou 10" text="Manches au choix" />
              <Fact title="5 catégories" text="Niveaux 3 à 6" />
            </div>
          </section>
          <div className="geo-setup-actions"><TrouNoirSetup /><TrouNoirRoomJoin /></div>
        </div>
      </div>
    </main>
  );
}

function Fact({ title, text }: { title: string; text: string }) {
  return <div className="geo-fact"><p>{title}</p><span>{text}</span></div>;
}
