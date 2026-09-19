"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { PublicGame } from "@/games/registry";
import { haveSameGameSlugs, parseVisibleGames } from "@/lib/visible-games";

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
const MAX_VISIBLE = 3;
const DRAG_THRESHOLD = 6;
// Tirage au hasard : 3 à 5 tours complets avant de ralentir sur la cible,
// sur une durée aléatoire de 2,6 s à 4,4 s (ralenti marqué en fin de course).
const SPIN_LOOPS_MIN = 3;
const SPIN_LOOPS_EXTRA = 3;
const SPIN_DURATION_MIN = 2600;
const SPIN_DURATION_RANGE = 1800;

function playableRoute(game: PublicGame): string | undefined {
  return game.availability === "coming_soon" ? undefined : PLAYABLE_ROUTES[game.slug];
}

/** Position relative à la carte active, en boucle continue (accepte un index flottant). */
export function wrappedOffset(index: number, active: number, total: number): number {
  let distance = index - active;
  const half = total / 2;
  while (distance > half) distance -= total;
  while (distance < -half) distance += total;
  return distance;
}

function layoutFor(width: number): { card: number; step: number } {
  if (width >= 1280) return { card: 200, step: 186 };
  if (width >= 1024) return { card: 182, step: 170 };
  if (width >= 768) return { card: 160, step: 150 };
  if (width >= 560) return { card: 142, step: 132 };
  return { card: 128, step: 118 };
}

export function HomeGameSelector({ games: initialGames }: { games: readonly PublicGame[] }) {
  const router = useRouter();
  // Affichage immédiat depuis le cache serveur (`initialGames`), puis
  // vérification en arrière-plan (`stale-while-revalidate` client) via
  // `GET /api/games/visible` : si les slugs ont changé, on remplace la liste.
  const [games, setGames] = useState(initialGames);
  const gamesRef = useRef(games);
  useEffect(() => {
    gamesRef.current = games;
  }, [games]);
  useEffect(() => {
    if (!haveSameGameSlugs(gamesRef.current, initialGames)) setGames(initialGames);
  }, [initialGames]);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const response = await fetch("/api/games/visible", { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const data = (await response.json().catch(() => null)) as { games?: unknown } | null;
        const fresh = parseVisibleGames(data?.games);
        if (!fresh || cancelled || haveSameGameSlugs(gamesRef.current, fresh)) return;
        setGames(fresh);
      } catch {
        // Panne réseau : on garde la liste servie depuis le cache.
      }
    }
    void refresh();
    function onFocus() {
      void refresh();
    }
    function onVisibility() {
      if (document.visibilityState === "visible") void refresh();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const total = games.length;
  const [position, setPosition] = useState(() => Math.max(0, games.findIndex((game) => game.slug === "geographie")));
  const [dragging, setDragging] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [width, setWidth] = useState(1200);
  const [imageAttempt, setImageAttempt] = useState<Record<string, number>>({});
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startPosition: number } | null>(null);
  const movedRef = useRef(false);
  const stepRef = useRef(layoutFor(1200).step);
  const spinFrameRef = useRef<number | null>(null);
  const spinningRef = useRef(false);

  // Annule le tirage en cours si la liste des jeux change ou au démontage.
  useEffect(() => {
    if (spinFrameRef.current !== null) {
      cancelAnimationFrame(spinFrameRef.current);
      spinFrameRef.current = null;
    }
    spinningRef.current = false;
    setSpinning(false);
  }, [total]);
  useEffect(() => () => {
    if (spinFrameRef.current !== null) cancelAnimationFrame(spinFrameRef.current);
  }, []);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const update = () => {
      const nextWidth = element.clientWidth;
      setWidth(nextWidth);
      stepRef.current = layoutFor(nextWidth).step;
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const { card, step } = layoutFor(width);
  const roundedActive = total > 0 ? ((Math.round(position) % total) + total) % total : 0;
  const activeGame = games[roundedActive] ?? null;
  const activeRoute = activeGame ? playableRoute(activeGame) : undefined;

  const goBy = useCallback((delta: number) => {
    setPosition((current) => Math.round(current) + delta);
  }, []);

  const goToIndex = useCallback((index: number) => {
    setPosition((current) => {
      const rounded = Math.round(current);
      return rounded + wrappedOffset(index, rounded, total);
    });
  }, [total]);

  /** Tirage au hasard : plusieurs tours rapides puis ralenti marqué jusqu'à la cible. */
  const shuffle = useCallback(() => {
    if (spinningRef.current || total <= 1) return;
    const target = Math.floor(Math.random() * total);
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      goToIndex(target);
      return;
    }
    const loops = SPIN_LOOPS_MIN + Math.floor(Math.random() * SPIN_LOOPS_EXTRA);
    const startPos = position;
    const startRounded = Math.round(startPos);
    const delta = loops * total + ((((target - startRounded) % total) + total) % total);
    const end = startRounded + delta;
    // Durée aléatoire : la vitesse de rotation varie d'un tirage à l'autre.
    const duration = SPIN_DURATION_MIN + Math.random() * SPIN_DURATION_RANGE;
    spinningRef.current = true;
    setSpinning(true);
    setDragging(false);
    dragRef.current = null;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(1, (now - startTime) / duration);
      // Ease-out quintique : départ rapide, arrivée très lente sur le jeu tiré.
      const eased = 1 - Math.pow(1 - elapsed, 5);
      setPosition(startPos + (end - startPos) * eased);
      if (elapsed < 1) {
        spinFrameRef.current = requestAnimationFrame(tick);
      } else {
        spinFrameRef.current = null;
        spinningRef.current = false;
        setSpinning(false);
        setPosition(end);
      }
    };
    spinFrameRef.current = requestAnimationFrame(tick);
  }, [position, total, goToIndex]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (spinningRef.current) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goBy(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goBy(1);
    } else if (event.key === "Home") {
      event.preventDefault();
      goToIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      goToIndex(total - 1);
    }
  }

  const dragHandlersRef = useRef<{ move: (event: PointerEvent) => void; up: () => void }>({ move: () => {}, up: () => {} });

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const deltaX = event.clientX - drag.startX;
      if (Math.abs(deltaX) > DRAG_THRESHOLD) movedRef.current = true;
      setPosition(drag.startPosition - deltaX / stepRef.current);
    };
    const up = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      setDragging(false);
      window.removeEventListener("pointermove", dragHandlersRef.current.move);
      window.removeEventListener("pointerup", dragHandlersRef.current.up);
      window.removeEventListener("pointercancel", dragHandlersRef.current.up);
      if (movedRef.current) setPosition((current) => Math.round(current));
    };
    dragHandlersRef.current = { move, up };
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || spinningRef.current) return;
    dragRef.current = { startX: event.clientX, startPosition: position };
    movedRef.current = false;
    setDragging(true);
    window.addEventListener("pointermove", dragHandlersRef.current.move);
    window.addEventListener("pointerup", dragHandlersRef.current.up);
    window.addEventListener("pointercancel", dragHandlersRef.current.up);
  }

  function onSelectClick(index: number, offset: number) {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    // Seul le bouton play lance la partie ; cliquer ailleurs recentre.
    if (Math.abs(offset) < 0.5) return;
    goToIndex(index);
  }

  function onPlayClick(route: string | undefined) {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    if (route) router.push(route);
  }

  if (!activeGame) {
    return (
      <section className="home-carousel home-carousel-empty" role="region" aria-label="Les jeux à deux">
        <p className="home-carousel-caption">
          <strong>Aucun jeu disponible pour le moment</strong>
          <span>Reviens un peu plus tard.</span>
        </p>
      </section>
    );
  }

  return (
    <section
      className="home-carousel"
      role="region"
      aria-roledescription="carrousel"
      aria-label="Les jeux à deux"
      tabIndex={0}
      data-dragging={dragging}
      data-spinning={spinning}
      onKeyDown={onKeyDown}
    >
      <div
        ref={viewportRef}
        className="home-carousel-viewport"
        onPointerDown={onPointerDown}
      >
        <ul className="home-carousel-track">
          {games.map((game, index) => {
            const offset = wrappedOffset(index, position, total);
            const clamped = Math.max(-(MAX_VISIBLE + 0.6), Math.min(MAX_VISIBLE + 0.6, offset));
            const distance = Math.abs(clamped);
            const hiddenCard = distance > MAX_VISIBLE + 0.35;
            const isActive = distance < 0.5;
            const route = playableRoute(game);
            const attempt = imageAttempt[game.slug] ?? 0;
            const extension = CARD_EXTENSIONS[attempt];
            const scale = 1.22 - Math.min(distance, MAX_VISIBLE) * 0.18;
            const translateX = clamped * step;
            const translateZ = -distance * 64;
            const rotateY = -clamped * 10;
            const rotateZ = clamped * 9;
            const brightness = 1 - Math.min(distance, MAX_VISIBLE) * 0.1;
            const saturation = 1 - Math.min(distance, MAX_VISIBLE) * 0.08;
            const opacity = hiddenCard ? 0 : Math.max(0.18, 1 - distance * 0.18);
            const zIndex = Math.round(200 - distance * 20);

            const transform = [
              "translate(-50%, -50%)",
              `translateX(${translateX.toFixed(1)}px)`,
              `translateZ(${translateZ.toFixed(1)}px)`,
              `rotateY(${rotateY.toFixed(2)}deg)`,
              `rotateZ(${rotateZ.toFixed(2)}deg)`,
              "translateY(var(--card-lift, 0px))",
              `scale(${scale.toFixed(3)})`,
            ].join(" ");
            const filter = [
              `drop-shadow(0 ${Math.round(18 + distance * 6)}px ${Math.round(28 + distance * 10)}px rgba(8, 3, 16, 0.6))`,
              isActive ? "drop-shadow(0 0 44px rgba(255, 95, 162, 0.42))" : "",
              `brightness(${brightness.toFixed(3)})`,
              `saturate(${saturation.toFixed(3)})`,
            ].filter(Boolean).join(" ");

            const style: CSSProperties = {
              width: `${card}px`,
              transform,
              filter,
              opacity,
              zIndex,
              pointerEvents: hiddenCard ? "none" : "auto",
            };

            const showPlay = isActive && !hiddenCard && Boolean(route);
            return (
              <li key={game.slug} className="home-carousel-item">
                <div
                  className="home-game-card"
                  style={style}
                  data-active={isActive}
                  aria-hidden={hiddenCard || undefined}
                >
                  <button
                    type="button"
                    className="home-card-select"
                    tabIndex={hiddenCard ? -1 : 0}
                    aria-hidden={hiddenCard || undefined}
                    aria-current={isActive}
                    aria-label={route ? `Voir ${game.cardName}` : `${game.cardName}, bientôt disponible`}
                    onClick={() => onSelectClick(index, offset)}
                  >
                    {extension ? (
                      <Image
                        src={`/home/cards/${game.slug}.${extension}`}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 45vw, (max-width: 1024px) 26vw, 20vw"
                        className="home-card-image"
                        draggable={false}
                        loading={isActive ? "eager" : "lazy"}
                        onError={() => setImageAttempt((current) => ({ ...current, [game.slug]: (current[game.slug] ?? 0) + 1 }))}
                      />
                    ) : (
                      <span className="home-card-fallback" aria-hidden="true">{game.cardName}</span>
                    )}
                  </button>
                  {showPlay && route ? (
                    <button
                      type="button"
                      className="home-card-play"
                      data-playable="true"
                      aria-label={`Jouer à ${game.cardName}`}
                      onClick={() => onPlayClick(route)}
                    >
                      <PlayIcon />
                    </button>
                  ) : (
                    <span className="home-card-play" data-playable="false" aria-hidden="true">
                      <PlayIcon />
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="home-carousel-controls">
        <button type="button" className="home-carousel-arrow" onClick={() => goBy(-1)} aria-label="Jeu précédent" disabled={spinning}>
          <ArrowIcon direction="left" />
        </button>
        <ul className="home-carousel-dots">
          {games.map((game, index) => (
            <li key={game.slug}>
              <button
                type="button"
                className="home-carousel-dot"
                aria-label={`Afficher ${game.cardName}`}
                aria-current={index === roundedActive}
                onClick={() => goToIndex(index)}
                disabled={spinning}
              />
            </li>
          ))}
        </ul>
        <button type="button" className="home-carousel-arrow" onClick={() => goBy(1)} aria-label="Jeu suivant" disabled={spinning}>
          <ArrowIcon direction="right" />
        </button>
      </div>

      <div className="home-carousel-shuffle-row">
        <button
          type="button"
          className="home-carousel-arrow home-carousel-shuffle"
          onClick={shuffle}
          aria-label="Choisir un jeu au hasard"
          title="Jeu au hasard"
          disabled={spinning || total <= 1}
          data-spinning={spinning}
        >
          <ShuffleIcon />
        </button>
      </div>

      <p className="home-carousel-caption" aria-live={spinning ? "off" : "polite"}>
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

/** Icône « lecture aléatoire » des applis de musique : deux flèches qui se croisent. */
function ShuffleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.8-1.1 2-1.7 3.3-1.7H22" />
      <path d="m18 2 4 4-4 4" />
      <path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2" />
      <path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8" />
      <path d="m18 14 4 4-4 4" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  );
}
