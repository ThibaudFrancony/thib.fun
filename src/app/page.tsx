import { HomeGameSelector } from "@/components/home-game-selector";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <div className="home-page">
      <a className="home-skip-link" href="#home-games">Aller aux jeux</a>
      <SiteHeader variant="home" />
      <main id="home-games" className="home-main">
        <div className="home-content">
          <div className="home-intro">
            <div className="home-intro-copy">
              <p className="home-eyebrow">La table est ouverte</p>
              <h1>On joue à quoi&nbsp;?</h1>
              <p>Choisis un jeu, invite ton ami et lance une partie sans détour.</p>
            </div>
            <div className="home-intro-note" aria-label="Informations sur les parties">
              <span>2 joueurs</span>
              <span>Parties privées</span>
            </div>
          </div>
          <HomeGameSelector />
        </div>
      </main>
      <footer className="home-footer">Deux joueurs. Un lien privé. Votre prochain rendez-vous.</footer>
    </div>
  );
}
