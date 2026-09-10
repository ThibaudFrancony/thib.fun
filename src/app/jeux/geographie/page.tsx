import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { GeographySetup, RoomJoin } from "@/games/geographie/components/geography-setup";

export default function GeographySetupPage() {
  return (
    <main className="geo-page geo-setup-page">
      <SiteHeader variant="geo" />
      <div className="geo-content geo-setup-content">
        <Link href="/" className="geo-back-link">← Tous les jeux</Link>
        <div className="geo-setup-layout">
          <section className="geo-hero-copy">
            <p className="geo-kicker">HexaPoint · Géographie</p>
            <h1 className="geo-hero-title">La ville est là. À toi de viser juste.</h1>
            <p className="geo-hero-lede">Deux placements par manche, une carte sans étiquette et un score qui récompense la précision. Les coordonnées ne partent qu’après ta confirmation.</p>
            <div className="geo-facts">
              <Fact title="2 joueurs" text="Un lien de salon privé" />
              <Fact title="5 à 15" text="Manches au choix" />
              <Fact title="France" text="Métropole + Corse" />
            </div>
          </section>
          <div className="geo-setup-actions"><GeographySetup /><RoomJoin /></div>
        </div>
      </div>
    </main>
  );
}

function Fact({ title, text }: { title: string; text: string }) {
  return <div className="geo-fact"><p>{title}</p><span>{text}</span></div>;
}
