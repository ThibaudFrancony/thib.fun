"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProfileButton } from "@/components/profile-button";
import { SalonLauncher } from "@/components/salon-dialog";
import { SignOutButton } from "@/components/sign-out-button";
import { useIsNarrow } from "@/lib/use-is-narrow";
import type { HeaderSession } from "@/lib/header-session";

export type CachedHeaderVariant = "default" | "home" | "geo";

function isFullSession(session: HeaderSession): session is Extract<HeaderSession, { connected: true }> {
  return session.connected === true;
}

/**
 * Îlot d'authentification du header pour les pages statiques.
 * Relit `GET /api/auth/session` côté client : la coquille de page reste
 * servie depuis le cache de route, seule cette pastille refait un appel
 * léger — bien moins coûteux que le rendu serveur complet d'avant.
 * Les pages privées (profil, leaderboard, salons, historique, admin)
 * gardent le `SiteHeader` serveur, inchangé.
 */
export function SiteHeaderAuth({ variant = "default" }: { variant?: CachedHeaderVariant }) {
  const [session, setSession] = useState<HeaderSession | null>(null);
  // En fenêtre étroite, le header du site se réduit au logo : la barre
  // d'onglets basse prend le relais, cet îlot ne monte rien (pas de polling).
  const narrow = useIsNarrow();

  useEffect(() => {
    if (narrow) return;
    const controller = new AbortController();
    void fetch("/api/auth/session", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          setSession({ connected: false });
          return;
        }
        const data = (await response.json().catch(() => null)) as HeaderSession | null;
        setSession(data && typeof data === "object" && "connected" in data ? data : { connected: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) setSession({ connected: false });
      });
    return () => controller.abort();
  }, [narrow]);

  if (narrow) return null;
  if (!session) return <AuthFallback variant={variant} />;
  if (variant === "home") return <HomeAuth session={session} />;
  if (variant === "geo") return <GeoAuth session={session} />;
  return <DefaultAuth session={session} />;
}

function AuthFallback({ variant }: { variant: CachedHeaderVariant }) {
  if (variant === "home") {
    return (
      <nav className="home-auth-nav" aria-label="Accès au compte" aria-busy="true">
        <SalonLauncher connected={false} />
        <span className="home-auth-link" aria-hidden="true">…</span>
      </nav>
    );
  }
  if (variant === "geo") {
    return (
      <nav className="geo-nav" aria-label="Navigation principale" aria-busy="true">
        <Link className="geo-nav-link" href="/">Jeux</Link>
        <SalonLauncher connected={false} triggerClassName="geo-nav-link" />
        <span className="geo-nav-link" aria-hidden="true">…</span>
      </nav>
    );
  }
  return (
    <nav className="flex items-center gap-2 text-sm font-semibold text-[var(--muted)]" aria-label="Navigation principale" aria-busy="true">
      <Link className="rounded-full px-3 py-2 hover:bg-white/70 hover:text-[var(--ink)]" href="/">Jeux</Link>
      <span className="rounded-full px-3 py-2" aria-hidden="true">…</span>
    </nav>
  );
}

function HomeAuth({ session }: { session: HeaderSession }) {
  return (
    <nav className="home-auth-nav" aria-label="Accès au compte">
      <SalonLauncher connected={session.connected} />
      {isFullSession(session) && !session.isGuest ? <Link href="/leaderboard" className="home-auth-link">Leaderboard</Link> : null}
      {!session.connected ? (
        <>
          <Link href="/connexion" className="home-auth-link">Connexion</Link>
          <Link href="/connexion?mode=signUp" className="home-auth-link home-signup-link">Inscription</Link>
        </>
      ) : session.isGuest ? (
        <>
          <span className="home-auth-link" aria-label={`Invité ${session.pseudo}`}>Invité · {session.pseudo}</span>
          <Link href="/connexion?mode=signUp" className="home-auth-link home-signup-link">Créer un compte</Link>
          <SignOutButton className="home-auth-link" />
        </>
      ) : (
        <>
          <ProfileButton
            name={session.effectiveName}
            needsOnboarding={session.needsOnboarding}
            preset={session.avatarPreset}
            avatarVersion={session.avatarVersion}
          />
          <SignOutButton className="home-auth-link" />
        </>
      )}
    </nav>
  );
}

function GeoAuth({ session }: { session: HeaderSession }) {
  return (
    <nav className="geo-nav" aria-label="Navigation principale">
      <Link className="geo-nav-link" href="/">Jeux</Link>
      <SalonLauncher connected={session.connected} triggerClassName="geo-nav-link" />
      {isFullSession(session) && !session.isGuest ? <Link className="geo-nav-link" href="/leaderboard">Leaderboard</Link> : null}
      {!session.connected ? (
        <Link className="geo-nav-link" href="/connexion">Connexion</Link>
      ) : session.isGuest ? (
        <>
          <span className="geo-nav-link" aria-label={`Invité ${session.pseudo}`}>Invité · {session.pseudo}</span>
          <Link className="geo-nav-link" href="/connexion?mode=signUp">Créer un compte</Link>
          <SignOutButton className="geo-nav-link" />
        </>
      ) : (
        <>
          <ProfileButton
            name={session.effectiveName}
            needsOnboarding={session.needsOnboarding}
            preset={session.avatarPreset}
            avatarVersion={session.avatarVersion}
          />
          <SignOutButton className="geo-nav-link" />
        </>
      )}
    </nav>
  );
}

function DefaultAuth({ session }: { session: HeaderSession }) {
  return (
    <nav className="flex items-center gap-2 text-sm font-semibold text-[var(--muted)]" aria-label="Navigation principale">
      <Link className="rounded-full px-3 py-2 hover:bg-white/70 hover:text-[var(--ink)]" href="/">Jeux</Link>
      {isFullSession(session) && !session.isGuest ? (
        <Link className="rounded-full px-3 py-2 hover:bg-white/70 hover:text-[var(--ink)]" href="/leaderboard">Leaderboard</Link>
      ) : null}
      {!session.connected ? (
        <Link className="rounded-full px-3 py-2 hover:bg-white/70 hover:text-[var(--ink)]" href="/connexion">Connexion</Link>
      ) : session.isGuest ? (
        <>
          <span className="rounded-full px-3 py-2 text-[var(--muted)]" aria-label={`Invité ${session.pseudo}`}>Invité · {session.pseudo}</span>
          <Link className="rounded-full px-3 py-2 hover:bg-white/70 hover:text-[var(--ink)]" href="/connexion?mode=signUp">Créer un compte</Link>
          <SignOutButton className="rounded-full px-3 py-2 hover:bg-white/70 hover:text-[var(--ink)]" />
        </>
      ) : (
        <>
          <ProfileButton
            name={session.effectiveName}
            needsOnboarding={session.needsOnboarding}
            preset={session.avatarPreset}
            avatarVersion={session.avatarVersion}
          />
          <SignOutButton className="rounded-full px-3 py-2 hover:bg-white/70 hover:text-[var(--ink)]" />
        </>
      )}
    </nav>
  );
}
