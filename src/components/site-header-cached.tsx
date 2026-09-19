import Link from "next/link";
import { SiteHeaderAuth, type CachedHeaderVariant } from "@/components/site-header-auth";

/**
 * Coquille de header pour les pages statiques (`/`, `/jeux/*`, `/connexion`,
 * `/entrainement/syllabes`). Aucun appel serveur ici — pas de `cookies()`,
 * pas de DB — donc la page reste mise en cache par Next. La partie compte
 * (`SalonLauncher`, liens, avatar) est rendue par l'îlot client
 * `SiteHeaderAuth` qui relit `GET /api/auth/session`.
 *
 * Les pages privées (profil, leaderboard, salons, historique, admin)
 * continuent d'utiliser le `SiteHeader` serveur, inchangé.
 */
export function SiteHeaderCached({ variant = "default" }: { variant?: CachedHeaderVariant }) {
  if (variant === "home") {
    return (
      <header className="home-header">
        <Link href="/" className="home-brand" aria-label="Accueil tibo.fun">
          <svg viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M10 9h12c3 0 5 3 6 7l1 6c.5 4-3 6-5 3l-4-4h-8l-4 4c-2 3-5.5 1-5-3l1-6c1-4 3-7 6-7Z" />
            <path d="M10 13v6m-3-3h6" />
            <circle cx="22" cy="14" r="1.3" fill="currentColor" stroke="none" />
            <circle cx="25" cy="18" r="1.3" fill="currentColor" stroke="none" />
          </svg>
          <span>tibo.fun</span>
        </Link>
        <SiteHeaderAuth variant="home" />
      </header>
    );
  }

  if (variant === "geo") {
    return (
      <header className="geo-header">
        <Link href="/" className="geo-brand" aria-label="Accueil tibo.fun">
          <svg viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M10 9h12c3 0 5 3 6 7l1 6c.5 4-3 6-5 3l-4-4h-8l-4 4c-2 3-5.5 1-5-3l1-6c1-4 3-7 6-7Z" />
            <path d="M10 13v6m-3-3h6" />
            <circle cx="22" cy="14" r="1.3" fill="currentColor" stroke="none" />
            <circle cx="25" cy="18" r="1.3" fill="currentColor" stroke="none" />
          </svg>
          <span>tibo.fun</span>
        </Link>
        <SiteHeaderAuth variant="geo" />
      </header>
    );
  }

  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
      <Link href="/" className="flex items-center gap-3" aria-label="Accueil tibo.fun">
        <span className="grid size-10 place-items-center rounded-2xl bg-[var(--green)] text-lg font-black text-white shadow-[4px_4px_0_var(--orange)]">t</span>
        <span className="text-lg font-black tracking-tight">tibo.fun</span>
      </Link>
      <SiteHeaderAuth variant="default" />
    </header>
  );
}
