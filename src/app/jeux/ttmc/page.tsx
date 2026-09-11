import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { TtmcRoomJoin, TtmcSetup } from "@/games/ttmc/components/ttmc-setup";

export default function TtmcSetupPage() {
  return (
    <main className="geo-page geo-setup-page">
      <SiteHeader variant="geo" />
      <div className="geo-content geo-setup-content">
        <Link href="/" className="geo-back-link">← Tous les jeux</Link>
        <div className="geo-setup-layout">
          <section className="geo-hero-copy">
            <p className="geo-kicker">À ton niveau · TTMC</p>
            <h1 className="geo-hero-title">Choisis ta difficulté et mise sur tes connaissances.</h1>
            <p className="geo-hero-lede">
              Un thème commun par manche, deux questions différentes, dix niveaux de 1 à 10 points.
              Bonne réponse : tu avances du niveau choisi. Mauvaise : tu restes en place. Objectif 30,
              manche toujours terminée avant de comparer.
            </p>
            <div className="geo-facts">
              <Fact title="2 joueurs" text="Un lien de salon privé" />
              <Fact title="20 / 30" text="Cibles disponibles" />
              <Fact title="22 thèmes" text="10 niveaux chacun" />
            </div>
          </section>
          <div className="geo-setup-actions"><TtmcSetup /><TtmcRoomJoin /></div>
        </div>
      </div>
    </main>
  );
}

function Fact({ title, text }: { title: string; text: string }) {
  return <div className="geo-fact"><p>{title}</p><span>{text}</span></div>;
}
