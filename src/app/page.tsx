import { HomeGameSelector } from "@/components/home-game-selector";
import { HomeHeroBackground } from "@/components/home-hero-background";
import { SiteHeaderCached } from "@/components/site-header-cached";
import { getVisibleGames } from "@/server/games/visibility";

// Coquille d'accueil mise en cache (régénérée au plus toutes les heures) :
// `getVisibleGames` ne lit que la table publique `games` via le rôle serveur,
// sans cookie. La partie compte du header est un îlot client (`SiteHeaderAuth`).
export const revalidate = 3600;

export default async function HomePage() {
  const games = await getVisibleGames();

  return (
    <div className="home-page">
      <a className="home-skip-link" href="#home-games">Aller aux jeux</a>
      <div className="home-hero">
        <HomeHeroBackground />
        <SiteHeaderCached variant="home" />
        <main id="home-games" className="home-main">
          <div className="home-hero-copy">
            <h1 className="home-hero-title">
              On joue à <span className="home-title-accent">quoi&nbsp;?</span>
            </h1>
            <p className="home-hero-subtitle">Des jeux à deux, des bons moments.</p>
          </div>
          <HomeGameSelector games={games} />
        </main>
      </div>
    </div>
  );
}
