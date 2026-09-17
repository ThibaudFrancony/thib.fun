"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
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
const MAX_VISIBLE = 3;
const DRAG_THRESHOLD = 6;

function playableRoute(game: PublicGame): string | undefined {
  return game.availability === "coming_soon" ? undefined : PLAYABLE_ROUTES[game.slug];
}

const INITIAL_INDEX = Math.max(0, PUBLIC_GAMES.findIndex((game) => game.slug === "geographie"));

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

export function HomeGameSelector() {
  const router = useRouter();
  const total = PUBLIC_GAMES.length;
  const [position, setPosition] = useState(INITIAL_INDEX);
  const [dragging, setDragging] = useState(false);
  const [width, setWidth] = useState(1200);
  const [imageAttempt, setImageAttempt] = useState<Record<string, number>>({});
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startPosition: number } | null>(null);
  const movedRef = useRef(false);
  const stepRef = useRef(layoutFor(1200).step);

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
  const roundedActive = ((Math.round(position) % total) + total) % total;
  const activeGame = PUBLIC_GAMES[roundedActive];
  const activeRoute = playableRoute(activeGame);

  const goBy = useCallback((delta: number) => {
    setPosition((current) => Math.round(current) + delta);
  }, []);

  const goToIndex = useCallback((index: number) => {
    setPosition((current) => {
      const rounded = Math.round(current);
      return rounded + wrappedOffset(index, rounded, total);
    });
  }, [total]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
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
    if (event.button !== 0) return;
    dragRef.current = { startX: event.clientX, startPosition: position };
    movedRef.current = false;
    setDragging(true);
    window.addEventListener("pointermove", dragHandlersRef.current.move);
    window.addEventListener("pointerup", dragHandlersRef.current.up);
    window.addEventListener("pointercancel", dragHandlersRef.current.up);
  }

  function onCardClick(index: number, offset: number) {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    if (Math.abs(offset) < 0.5) {
      const route = playableRoute(PUBLIC_GAMES[index]);
      if (route) router.push(route);
      return;
    }
    goToIndex(index);
  }

  return (
    <section
      className="home-carousel"
      role="region"
      aria-roledescription="carrousel"
      aria-label="Les neuf jeux à deux"
      tabIndex={0}
      data-dragging={dragging}
      onKeyDown={onKeyDown}
    >
      <div
        ref={viewportRef}
        className="home-carousel-viewport"
        onPointerDown={onPointerDown}
      >
        <ul className="home-carousel-track">
          {PUBLIC_GAMES.map((game, index) => {
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

            return (
              <li key={game.slug} className="home-carousel-item">
                <button
                  type="button"
                  className="home-game-card"
                  style={style}
                  data-active={isActive}
                  aria-current={isActive}
                  aria-hidden={hiddenCard}
                  tabIndex={hiddenCard ? -1 : 0}
                  aria-label={isActive && route ? `Jouer à ${game.cardName}` : route ? `Voir ${game.cardName}` : `${game.cardName}, bientôt disponible`}
                  onClick={() => onCardClick(index, offset)}
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
                  <span className="home-card-play" aria-hidden="true">
                    <PlayIcon />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="home-carousel-controls">
        <button type="button" className="home-carousel-arrow" onClick={() => goBy(-1)} aria-label="Jeu précédent">
          <ArrowIcon direction="left" />
        </button>
        <ul className="home-carousel-dots">
          {PUBLIC_GAMES.map((game, index) => (
            <li key={game.slug}>
              <button
                type="button"
                className="home-carousel-dot"
                aria-label={`Afficher ${game.cardName}`}
                aria-current={index === roundedActive}
                onClick={() => goToIndex(index)}
              />
            </li>
          ))}
        </ul>
        <button type="button" className="home-carousel-arrow" onClick={() => goBy(1)} aria-label="Jeu suivant">
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
    <svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  );
}
