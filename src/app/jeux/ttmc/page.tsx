import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { TtmcRoomJoin, TtmcSetup } from "@/games/ttmc/components/ttmc-setup";

export default function TtmcSetupPage() {
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
            <p className="geo-hx-kicker">À ton niveau · TTMC</p>
            <h1 className="geo-hx-title">
              Choisis ton niveau.<br />
              Mise sur <span className="geo-hx-accent">tes connaissances.</span>
            </h1>
            <p className="geo-hx-lede">
              Un thème commun par manche, deux questions différentes, dix niveaux de 1 à 10 points.
              Bonne réponse : tu avances du niveau choisi. Mauvaise : tu restes en place. Objectif 30,
              manche toujours terminée avant de comparer.
            </p>
            <div className="geo-hx-facts">
              <Fact title="2 joueurs" text="Un lien de salon privé" />
              <Fact title="20 / 30" text="Cibles disponibles" />
              <Fact title="22 thèmes" text="10 niveaux chacun" />
            </div>
          </section>
          <div className="geo-hx-actions"><TtmcSetup /><TtmcRoomJoin /></div>
        </div>
      </div>
    </main>
  );
}

function Fact({ title, text }: { title: string; text: string }) {
  return <div className="geo-fact"><p>{title}</p><span>{text}</span></div>;
}
