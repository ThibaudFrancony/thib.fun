import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { RoomJoin } from "@/games/geographie/components/geography-setup";
import { LongueurOndeSetup } from "@/games/longueur-onde/components/longueur-onde-setup";

export default function LongueurOndePage() {
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
            <p className="geo-hx-kicker">À l&apos;unisson · Longueur d&apos;onde</p>
            <h1 className="geo-hx-title">
              Un indice, une aiguille.<br />
              Trouvez <span className="geo-hx-accent">le même point.</span>
            </h1>
            <p className="geo-hx-lede">
              Un indice simple, une aiguille, une intuition. Faites converger vos réponses sur des axes du quotidien, de la culture et de l&apos;absurde.
            </p>
            <div className="geo-hx-facts">
              <Fact title="0 → 100" text="Une cible secrète sur chaque axe" />
              <Fact title="4 points" text="Pour viser la bonne zone" />
              <Fact title="100 % coop" text="Un score partagé, jamais de perdant" />
            </div>
          </section>
          <div className="geo-hx-actions"><LongueurOndeSetup /><RoomJoin /></div>
        </div>
      </div>
    </main>
  );
}

function Fact({ title, text }: { title: string; text: string }) {
  return <div className="geo-fact"><p>{title}</p><span>{text}</span></div>;
}
