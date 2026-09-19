/**
 * Squelette affiché pendant la navigation entre pages.
 * Fond sombre cohérent avec la DA (violet/bleu nuit) pour éviter
 * le flash blanc cassé du `body` clair pendant que le segment
 * dynamique (profil, leaderboard, salon, partie…) charge.
 */
export default function Loading() {
  return (
    <main className="app-loading" aria-busy="true" aria-label="Chargement de la page">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8">
        <p className="app-loading-kicker">Chargement…</p>
        <div className="mt-4 h-8 w-40 animate-pulse rounded-full bg-white/10" />
        <div className="mt-8 h-12 w-2/3 animate-pulse rounded-2xl bg-white/10" />
        <div className="mt-4 h-6 w-1/2 animate-pulse rounded-2xl bg-white/5" />
      </div>
    </main>
  );
}
