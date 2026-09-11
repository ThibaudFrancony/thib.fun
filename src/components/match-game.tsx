"use client";

import { useEffect, useState } from "react";
import { GeographyMatch } from "@/games/geographie/components/geography-match";
import { SkyjoMatch } from "@/games/skyjo/components/skyjo-match";
import { TrouNoirMatch } from "@/games/trou-noir/components/trou-noir-match";
import { TtmcMatch } from "@/games/ttmc/components/ttmc-match";
import { BombpartyMatch } from "@/games/bombparty/components/bombparty-match";
import { BatailleNavaleMatch } from "@/games/bataille-navale/components/bataille-navale-match";
import { UnoMatch } from "@/games/uno/components/uno-match";
import { CompatibiliteMatch } from "@/games/compatibilite/components/compatibilite-match";
import { LongueurOndeMatch } from "@/games/longueur-onde/components/longueur-onde-match";

export function MatchGame({ matchId }: { matchId: string }) {
  const [gameSlug, setGameSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/matches/${matchId}`, { cache: "no-store" }).then(async (response) => {
      const data = await response.json().catch(() => null) as { gameSlug?: string; error?: { message?: string } } | null;
      if (cancelled) return;
      if (!response.ok || !data?.gameSlug) setError(data?.error?.message ?? "Partie introuvable.");
      else setGameSlug(data.gameSlug);
    }).catch(() => { if (!cancelled) setError("Partie introuvable."); });
    return () => { cancelled = true; };
  }, [matchId]);
  if (error) return <main className="min-h-screen px-5 py-12"><div role="alert" className="mx-auto max-w-xl rounded-2xl bg-red-50 p-5 text-red-700">{error}</div></main>;
  if (gameSlug === "geographie") return <GeographyMatch matchId={matchId} />;
  if (gameSlug === "trou-noir") return <TrouNoirMatch matchId={matchId} />;
  if (gameSlug === "ttmc") return <TtmcMatch matchId={matchId} />;
  if (gameSlug === "uno") return <UnoMatch matchId={matchId} />;
  if (gameSlug === "skyjo") return <SkyjoMatch matchId={matchId} />;
  if (gameSlug === "bombparty") return <BombpartyMatch matchId={matchId} />;
  if (gameSlug === "bataille-navale") return <BatailleNavaleMatch matchId={matchId} />;
  if (gameSlug === "compatibilite") return <CompatibiliteMatch matchId={matchId} />;
  if (gameSlug === "longueur-onde") return <LongueurOndeMatch matchId={matchId} />;
  return <main className="min-h-screen px-5 py-12"><div className="mx-auto max-w-xl rounded-3xl border border-[var(--line)] bg-white/70 p-8 text-center text-[var(--muted)]">Chargement de la partie…</div></main>;
}
