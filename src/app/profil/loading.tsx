/**
 * Squelette du segment `/profil` (et `/profil/[id]`).
 * Réutilise la coquille sombre `.pf-page` pour que la navigation
 * garde le même fond violet nuit, sans flash clair.
 */
export default function ProfileLoading() {
  return (
    <div className="pf-page" aria-busy="true" aria-label="Chargement du profil">
      <div className="pf-layout">
        <div className="pf-col-profile">
          <div className="pf-card" aria-hidden="true">
            <div className="h-4 w-32 animate-pulse rounded-full bg-white/10" />
            <div className="h-10 w-3/4 animate-pulse rounded-2xl bg-white/10" />
            <div className="h-28 w-28 animate-pulse rounded-full bg-white/10" />
            <div className="h-12 w-full animate-pulse rounded-2xl bg-white/5" />
          </div>
        </div>
        <div className="pf-col-history">
          <div className="pf-history" aria-hidden="true">
            <div className="h-4 w-40 animate-pulse rounded-full bg-white/10" />
            <div className="mt-3 h-8 w-2/3 animate-pulse rounded-2xl bg-white/10" />
            <div className="mt-4 h-16 w-full animate-pulse rounded-2xl bg-white/5" />
            <div className="mt-3 h-16 w-full animate-pulse rounded-2xl bg-white/5" />
          </div>
        </div>
      </div>
    </div>
  );
}
