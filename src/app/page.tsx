import { HomeGameSelector } from "@/components/home-game-selector";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <div className="home-page">
      <a className="home-skip-link" href="#home-games">Aller aux jeux</a>
      <SiteHeader variant="home" />
      <main id="home-games" className="home-main">
        <div className="home-intro">
          <p className="home-eyebrow">À deux, c’est mieux</p>
          <h1>On joue à quoi ?</h1>
          <p>Choisis un jeu, retrouve ton ami et partage un bon moment.</p>
        </div>
        <HomeGameSelector />
      </main>
      <footer className="home-footer">Deux joueurs. Un lien privé. Votre prochain rendez-vous.</footer>
    </div>
  );
}
