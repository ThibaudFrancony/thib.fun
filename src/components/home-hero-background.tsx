"use client";

import Image from "next/image";
import { useState } from "react";

const HERO_EXTENSIONS = ["png", "webp"] as const;

export function HomeHeroBackground() {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const extension = HERO_EXTENSIONS[attempt];

  return (
    <div className="home-hero-bg" data-loaded={loaded}>
      {extension ? (
        <Image
          src={`/home/hero.${extension}`}
          alt=""
          fill
          priority
          sizes="100vw"
          className="home-hero-image"
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            setAttempt((current) => current + 1);
          }}
        />
      ) : null}
    </div>
  );
}
