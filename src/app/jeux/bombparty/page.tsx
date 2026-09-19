import Image from "next/image";
import Link from "next/link";
import { SiteHeaderCached } from "@/components/site-header-cached";
import { GameRoomAside } from "@/components/game-room-aside";
import { RoomJoin } from "@/games/geographie/components/geography-setup";
import { BombpartySetup } from "@/games/bombparty/components/bombparty-setup";

// Page vitrine mise en cache (régénérée au plus toutes les heures) : aucun
// appel serveur au rendu. Le salon actif est détecté côté client par
// `GameRoomAside` (`useActiveGroupRoom`), le compte par l'îlot `SiteHeaderAuth`.
export const revalidate = 3600;

export default function BombpartyPage() {
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
            <p className="geo-hx-kicker">Syllabe Express · BombParty</p>
            <h1 className="geo-hx-title">
              Le bon mot.<br />
              Avant la <span className="geo-hx-accent">fin du chrono.</span>
            </h1>
            <p className="geo-hx-lede">
              Une séquence s&apos;affiche, propose un mot qui la contient. Chaque mot valide passe la main et raccourcit le chrono.
            </p>
            <div className="geo-hx-facts">
              <Fact title="3 ou 5 vies" text="Le chrono coûte cher" />
              <Fact title="200 tours max" text="Vies puis mots" />
              <Fact title="Dictionnaire fixe" text="Aucune aide en match" />
            </div>
            <p className="geo-panel-note">
              Pour t&apos;échauffer sans enjeu, rendez-vous à l&apos;entraînement solo :{" "}
              <Link href="/entrainement/syllabes" className="underline font-bold text-white">Syllabes en solo</Link>.
            </p>
          </section>
          <div className="geo-hx-actions"><BombpartySetup /><GameRoomAside fallback={<RoomJoin />} /></div>
        </div>
      </div>
    </main>
  );
}

function Fact({ title, text }: { title: string; text: string }) {
  return <div className="geo-fact"><p>{title}</p><span>{text}</span></div>;
}
