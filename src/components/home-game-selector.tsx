"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { PUBLIC_GAMES, type PublicGame } from "@/games/registry";

const PLAYABLE_ROUTES: Readonly<Partial<Record<string, string>>> = {
  geographie: "/jeux/geographie",
  uno: "/jeux/uno",
  skyjo: "/jeux/skyjo",
  "trou-noir": "/jeux/trou-noir",
  ttmc: "/jeux/ttmc",
  bombparty: "/jeux/bombparty",
  "bataille-navale": "/jeux/bataille-navale",
  compatibilite: "/jeux/compatibilite",
  "longueur-onde": "/jeux/longueur-onde",
};

const CARD_EXTENSIONS = ["png", "webp"] as const;

function playableRoute(game: PublicGame): string | undefined {
  return game.availability === "coming_soon" ? undefined : PLAYABLE_ROUTES[game.slug];
}

const INITIAL_INDEX = Math.max(0, PUBLIC_GAMES.findIndex((game) => game.slug === "geographie"));

/** Position relative à la carte active, en boucle continue. */
export function wrappedOffset(index: number, active: number, total: number): number {
  let distance = index - active;
  const half = Math.floor(total / 2);
  if (distance > half) distance -= total;
  if (distance < -half) distance += total;
  return distance;
}

const VISIBLE_RANGE = 2;
const SWIPE_THRESHOLD = 48;

export function HomeGameSelector() {
  const total = PUBLIC_GAMES.length;
  const [active, setActive] = useState(INITIAL_INDEX);
  const [imageAttempt, setImageAttempt] = useState<Record<string, number>>({});
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const activeGame = PUBLIC_GAMES[active];
  const activeRoute = playableRoute(activeGame);

  const go = useCallback((delta: number) => {
    setActive((current) => (current + delta + total) % total);
  }, [total]);

  const select = useCallback((index: number) => {
    setActive(((index % total) + total) % total);
  }, [total]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      go(1);
    } else if (event.key === "Home") {
      event.preventDefault();
      select(0);
    } else if (event.key === "End") {
      event.preventDefault();
      select(total - 1);
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    pointerStart.current = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY)) return;
    go(deltaX < 0 ? 1 : -1);
  }

  return (
    <section
      className="home-carousel"
      role="region"
      aria-roledescription="carrousel"
      aria-label="Les neuf jeux à deux"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div className="home-carousel-viewport" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <ul className="home-carousel-track">
          {PUBLIC_GAMES.map((game, index) => {
            const offset = wrappedOffset(index, active, total);
            const hidden = Math.abs(offset) > VISIBLE_RANGE;
            const isActive = offset === 0;
            const route = playableRoute(game);
            const attempt = imageAttempt[game.slug] ?? 0;
            const extension = CARD_EXTENSIONS[attempt];
            const style = { "--offset": String(offset) } as CSSProperties;
            const content = (
              <>
                {extension ? (
                  <Image
                    src={`/home/cards/${game.slug}.${extension}`}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 60vw, (max-width: 1100px) 32vw, 20vw"
                    className="home-card-image"
                    loading={isActive ? "eager" : "lazy"}
                    onError={() => setImageAttempt((current) => ({ ...current, [game.slug]: (current[game.slug] ?? 0) + 1 }))}
                  />
                ) : (
                  <span className="home-card-fallback" aria-hidden="true">{game.cardName}</span>
                )}
                <span className="home-card-play" aria-hidden="true">
                  <PlayIcon />
                </span>
              </>
            );

            return (
              <li key={game.slug} className="home-carousel-item">
                {isActive && route ? (
                  <Link
                    href={route}
                    className="home-game-card"
                    data-offset="0"
                    data-ready="true"
                    data-hidden="false"
                    style={style}
                    aria-label={`Jouer à ${game.cardName}`}
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="home-game-card"
                    data-offset={offset}
                    data-ready={route ? "true" : "false"}
                    data-hidden={hidden}
                    style={style}
                    aria-current={isActive}
                    aria-label={route ? `Voir ${game.cardName}` : `${game.cardName}, bientôt disponible`}
                    onClick={() => select(index)}
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="home-carousel-controls">
        <button type="button" className="home-carousel-arrow" onClick={() => go(-1)} aria-label="Jeu précédent">
          <ArrowIcon direction="left" />
        </button>
        <ul className="home-carousel-dots">
          {PUBLIC_GAMES.map((game, index) => (
            <li key={game.slug}>
              <button
                type="button"
                className="home-carousel-dot"
                aria-label={`Afficher ${game.cardName}`}
                aria-current={index === active}
                onClick={() => select(index)}
              />
            </li>
          ))}
        </ul>
        <button type="button" className="home-carousel-arrow" onClick={() => go(1)} aria-label="Jeu suivant">
          <ArrowIcon direction="right" />
        </button>
      </div>

      <p className="home-carousel-caption" aria-live="polite">
        <strong>{activeGame.cardName}</strong>
        <span>{activeGame.description}</span>
        {activeRoute ? null : <span className="home-carousel-soon">Bientôt disponible</span>}
      </p>
    </section>
  );
}

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={direction === "left" ? "M19 12H5m6-6-6 6 6 6" : "M5 12h14m-6-6 6 6-6 6"} />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  );
}
