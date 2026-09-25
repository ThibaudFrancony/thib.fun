"use client";

import type { CSSProperties } from "react";

const CONFETTI_COLORS = [
  "#ff5fa2",
  "#ff8a5b",
  "#ffe49a",
  "#b9f9df",
  "#b5e6ff",
  "#e8d7ff",
  "#ffc9e5",
  "#89f4dd",
];

const CONFETTI_COUNT = 18;

/** Pluie de confettis CSS, purement décorative (UI seule, aucun jeu modifié). */
export function MotionConfetti() {
  return (
    <div className="motion-confetti" aria-hidden="true">
      {Array.from({ length: CONFETTI_COUNT }, (_, index) => (
        <span
          key={index}
          style={{
            "--motion-left": `${4 + ((index * 53) % 92)}%`,
            "--motion-x": `${((index * 37) % 120) - 60}px`,
            "--motion-color": CONFETTI_COLORS[index % CONFETTI_COLORS.length],
            "--motion-delay": `${(index % 6) * 45}ms`,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
