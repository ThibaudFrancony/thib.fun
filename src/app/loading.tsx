/**
 * Squelette affiché pendant la navigation entre pages.
 * Aucune donnée ici : il peint instantanément pendant que le segment
 * dynamique (profil, salon, partie…) charge, au lieu d'une page blanche.
 */
export default function Loading() {
  return (
    <main className="min-h-screen" aria-busy="true" aria-label="Chargement de la page">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <div className="h-8 w-40 animate-pulse rounded-full bg-black/10" />
        <div className="mt-8 h-12 w-2/3 animate-pulse rounded-2xl bg-black/10" />
        <div className="mt-4 h-6 w-1/2 animate-pulse rounded-2xl bg-black/5" />
      </div>
    </main>
  );
}
