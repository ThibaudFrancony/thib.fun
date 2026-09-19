/**
 * Squelette du segment `/leaderboard`.
 * Réutilise la coquille sombre `.lb-page` (fond spatial + règle
 * `html:has(.lb-page)`) pour éviter tout flash clair.
 */
export default function LeaderboardLoading() {
  return (
    <main className="lb-page" aria-busy="true" aria-label="Chargement du classement">
      <div className="lb-content" aria-hidden="true">
        <div className="h-4 w-48 animate-pulse rounded-full bg-white/10" />
        <div className="mt-4 h-14 w-2/3 animate-pulse rounded-2xl bg-white/10" />
        <div className="mt-4 h-6 w-1/2 animate-pulse rounded-2xl bg-white/5" />
        <div className="lb-podium">
          <div className="lb-card" data-empty="true">
            <div className="h-16 w-16 animate-pulse rounded-full bg-white/10" />
            <div className="mt-3 h-6 w-20 animate-pulse rounded-full bg-white/10" />
          </div>
          <div className="lb-card" data-empty="true">
            <div className="h-20 w-20 animate-pulse rounded-full bg-white/10" />
            <div className="mt-3 h-7 w-24 animate-pulse rounded-full bg-white/10" />
          </div>
          <div className="lb-card" data-empty="true">
            <div className="h-16 w-16 animate-pulse rounded-full bg-white/10" />
            <div className="mt-3 h-6 w-20 animate-pulse rounded-full bg-white/10" />
          </div>
        </div>
        <div className="lb-panel mt-8">
          <div className="h-16 w-full animate-pulse rounded-2xl bg-white/5" />
        </div>
      </div>
    </main>
  );
}
