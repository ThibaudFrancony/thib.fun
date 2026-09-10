"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { PUBLIC_GAMES, type PublicGame } from "@/games/registry";

// Only games with an implemented UI can be opened, even if metadata changes.
const PLAYABLE_ROUTES: Readonly<Partial<Record<string, string>>> = {
  geographie: "/jeux/geographie",
  uno: "/jeux/uno",
};

function playableRoute(game: PublicGame) {
  return game.availability === "coming_soon" ? undefined : PLAYABLE_ROUTES[game.slug];
}

const availableCount = PUBLIC_GAMES.filter((game) => playableRoute(game)).length;

export function HomeGameSelector() {
  const railRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ previous: false, next: true });

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    function updateEdges() {
      if (!rail) return;
      const previous = rail.scrollLeft > 2;
      const next = rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 2;
      setEdges((current) => current.previous === previous && current.next === next
        ? current
        : { previous, next });
    }

    updateEdges();
    rail.addEventListener("scroll", updateEdges, { passive: true });
    const observer = new ResizeObserver(updateEdges);
    observer.observe(rail);
    return () => {
      rail.removeEventListener("scroll", updateEdges);
      observer.disconnect();
    };
  }, []);

  function move(direction: -1 | 1, toEdge = false) {
    const rail = railRef.current;
    if (!rail) return;
    const cards = rail.querySelectorAll<HTMLLIElement>("li");
    const step = cards.length > 1
      ? cards[1].offsetLeft - cards[0].offsetLeft
      : rail.clientWidth;

    rail.scrollTo({
      left: toEdge ? (direction === 1 ? rail.scrollWidth : 0) : rail.scrollLeft + direction * step,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }

  function onRailKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.target !== event.currentTarget) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      move(event.key === "ArrowLeft" || event.key === "Home" ? -1 : 1, event.key === "Home" || event.key === "End");
    }
  }

  return (
    <section className="home-selector" aria-label="Les jeux à deux">
      <div className="home-selector-meta">
        <span>{PUBLIC_GAMES.length} jeux à découvrir</span>
        <span className="home-available-count">{availableCount} {availableCount === 1 ? "disponible" : "disponibles"}</span>
      </div>
      <div className="home-rail-shell">
        <button
          type="button"
          className="home-rail-arrow home-rail-previous"
          aria-label="Voir les jeux précédents"
          aria-controls="home-game-rail"
          disabled={!edges.previous}
          onClick={() => move(-1)}
        >
          <ArrowIcon direction="left" />
        </button>
        <div
          ref={railRef}
          id="home-game-rail"
          className="home-game-rail"
          role="region"
          aria-label="Catalogue des jeux"
          aria-roledescription="carrousel"
          aria-describedby="home-rail-help"
          tabIndex={0}
          onKeyDown={onRailKeyDown}
        >
          <ul className="home-game-track">
            {PUBLIC_GAMES.map((game, index) => (
              <li key={game.slug} className="home-game-slide">
                <GameCard game={game} index={index} />
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          className="home-rail-arrow home-rail-next"
          aria-label="Voir les jeux suivants"
          aria-controls="home-game-rail"
          disabled={!edges.next}
          onClick={() => move(1)}
        >
          <ArrowIcon direction="right" />
        </button>
      </div>
      <p id="home-rail-help" className="home-rail-help">
        Fais défiler les jeux ou utilise les flèches.
        <span className="sr-only"> Au clavier, place le focus sur le catalogue et utilise les flèches gauche et droite. Début et Fin vont au premier et au dernier jeu.</span>
      </p>
    </section>
  );
}

function GameCard({ game, index }: { game: PublicGame; index: number }) {
  const href = playableRoute(game);
  const titleId = `home-game-${game.slug}`;
  const statusId = `${titleId}-status`;
  const content = (
    <>
      <div className="home-card-topline">
        <span className="home-card-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <span id={statusId} className="home-card-status">{href ? (game.availability === "beta" ? "Bêta" : "Disponible") : "Bientôt"}</span>
      </div>
      <div className="home-card-art"><GameIcon slug={game.slug} /></div>
      <h2 id={titleId} className="home-card-title">{game.displayName}</h2>
      <p className="home-card-description">{game.description}</p>
      <div className="home-card-details">
        <span>2 joueurs · {game.kind === "cooperative" ? "Coop" : "Duel"}</span>
        <span>{game.duration}</span>
      </div>
      <div className="home-card-action">
        {href ? <><span>Jouer</span><ArrowIcon direction="right" /></> : <span>Pas encore disponible</span>}
      </div>
    </>
  );

  return href ? (
    <Link href={href} className="home-game-card" data-game={game.slug} data-ready="true" aria-labelledby={titleId} aria-describedby={statusId}>
      {content}
    </Link>
  ) : (
    <article className="home-game-card" data-game={game.slug} aria-labelledby={titleId} aria-describedby={statusId}>
      {content}
    </article>
  );
}

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={direction === "left" ? "M19 12H5m6-6-6 6 6 6" : "M5 12h14m-6-6 6 6-6 6"} />
    </svg>
  );
}

function GameIcon({ slug }: { slug: string }) {
  let drawing;
  switch (slug) {
    case "trou-noir":
      drawing = <><ellipse cx="60" cy="65" rx="45" ry="22" transform="rotate(-25 60 65)" /><ellipse cx="60" cy="65" rx="29" ry="13" transform="rotate(-25 60 65)" /><circle cx="60" cy="65" r="12" fill="currentColor" stroke="none" /><path d="M36 19v16m-8-8h16m49 2v10m-5-5h10M26 93l-5 8" /></>;
      break;
    case "ttmc":
      drawing = <><path d="M22 95V76h25V55h25V34h25v61H22Z" /><path d="M28 24h9m-4.5-4.5v9M66 13l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z" fill="currentColor" stroke="none" /></>;
      break;
    case "geographie":
      drawing = <><path d="m18 38 27-10 30 12 27-10v57L75 98 45 86 18 96V38Z" /><path d="M45 29v57m30-25v37" /><path d="M91 34c0 12-16 28-16 28S59 46 59 34a16 16 0 1 1 32 0Z" fill="var(--game-deep)" /><circle cx="75" cy="34" r="5" /></>;
      break;
    case "skyjo":
      drawing = <>{[0, 1, 2].map((column) => [0, 1, 2, 3].map((row) => <rect key={`${column}-${row}`} x={26 + column * 25} y={16 + row * 24} width="18" height="18" rx="4" fill={column === 1 && row === 1 ? "currentColor" : "none"} />))}</>;
      break;
    case "uno":
      drawing = <><rect x="25" y="28" width="51" height="68" rx="9" transform="rotate(-18 50 62)" /><rect x="49" y="21" width="49" height="70" rx="9" transform="rotate(13 73 56)" fill="var(--game-deep)" /><path d="m79 38-17 23h15L65 79" /></>;
      break;
    case "bombparty":
      drawing = <><circle cx="53" cy="73" r="29" /><path d="m69 47 7-13 10 5-8 14M82 36c15-1 2-18 15-18M98 7v-4m11 17h5m-7-10 4-4M38 59c-5 4-8 10-7 16" /></>;
      break;
    case "bataille-navale":
      drawing = <><path d="m16 67 44-15 44 15-16 23H32L16 67Zm29-10V35h30v22M59 35V18m0 4h18M14 100q12-10 24 0 12-10 24 0 12-10 24 0 12-10 24 0" /><path d="M60 68v16" /></>;
      break;
    case "compatibilite":
      drawing = <><path d="M61 93 24 58C2 35 34 12 53 34l8 9 8-9c19-22 51 1 29 24L61 93Z" /><path d="M43 55h1m33 0h1M48 70q13 13 26 0" strokeWidth="5" /></>;
      break;
    case "longueur-onde":
      drawing = <><path d="M14 88a46 46 0 0 1 92 0H14Zm46-46v9M29 55l7 7m55-7-7 7M60 87l22-29" /><circle cx="60" cy="87" r="5" fill="currentColor" /><path d="M44 104h32" /></>;
      break;
    default:
      drawing = <><rect x="25" y="25" width="70" height="70" rx="16" /><circle cx="46" cy="46" r="4" /><circle cx="74" cy="74" r="4" /></>;
  }

  return (
    <svg viewBox="0 0 120 120" width="120" height="120" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {drawing}
    </svg>
  );
}
