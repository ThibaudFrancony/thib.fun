import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { RoomJoin } from "@/games/geographie/components/geography-setup";
import { BatailleNavaleSetup } from "@/games/bataille-navale/components/bataille-navale-setup";

export default function BatailleNavalePage() {
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
            <p className="geo-hx-kicker">Flotte cachée · Bataille navale</p>
            <h1 className="geo-hx-title">
              Repère la flotte.<br />
              Coule <span className="geo-hx-accent">l&apos;adversaire.</span>
            </h1>
            <p className="geo-hx-lede">
              Cinq bateaux, 17 cases, un tir par tour. Toucher ne fait pas rejouer.
            </p>
            <div className="geo-hx-facts">
              <Fact title="5 bateaux" text="17 cases au total" />
              <Fact title="10 × 10" text="Lignes A–J, colonnes 1–10" />
              <Fact title="1 tir / tour" text="Sans rejouer" />
            </div>
          </section>
          <div className="geo-hx-actions"><BatailleNavaleSetup /><RoomJoin /></div>
        </div>
      </div>
    </main>
  );
}

function Fact({ title, text }: { title: string; text: string }) {
  return <div className="geo-fact"><p>{title}</p><span>{text}</span></div>;
}
