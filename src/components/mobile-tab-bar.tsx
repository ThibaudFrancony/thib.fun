"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProfileButton } from "@/components/profile-button";
import { SalonLauncher } from "@/components/salon-dialog";
import { useIsNarrow } from "@/lib/use-is-narrow";
import type { HeaderSession } from "@/lib/header-session";

function HouseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="m4 11 8-7 8 7" />
      <path d="M6 9.5V20h12V9.5" />
    </svg>
  );
}

function SalonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M13 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5" />
      <path d="M10 12h9" />
      <path d="m13 8 4 4-4 4" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5H4a3 3 0 0 0 3 5m8-5h4a3 3 0 0 1-3 5M12 13v4m-4 3h8m-8 0 1-3h6l1 3" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

/**
 * Barre d'onglets basse, rendue uniquement en fenêtre étroite (téléphone).
 * Jeux / Salon / Leaderboard / Profil, 100 % icônes. Le chat vit dans le
 * mini-header du haut. Îlot client : relit `GET /api/auth/session` comme
 * `SiteHeaderAuth`, jamais monté au large (aucun appel ni polling).
 */
export function MobileTabBar() {
  const narrow = useIsNarrow();
  const pathname = usePathname();
  const [session, setSession] = useState<HeaderSession | null>(null);

  useEffect(() => {
    if (!narrow) return;
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

  if (!narrow) return null;

  const connected = session?.connected === true;
  const isGuest = connected && session.isGuest;
  const showLeaderboard = connected && !isGuest;

  return (
    <nav className="mobile-tabbar" aria-label="Navigation principale">
      <Link href="/" className="mobile-tab" data-active={pathname === "/"} aria-current={pathname === "/" ? "page" : undefined} aria-label="Jeux">
        <HouseIcon />
      </Link>
      <SalonLauncher connected={connected} triggerClassName="mobile-tab" icon={<SalonIcon />} triggerLabel="Salon" />
      {showLeaderboard ? (
        <Link href="/leaderboard" className="mobile-tab" data-active={pathname === "/leaderboard"} aria-current={pathname === "/leaderboard" ? "page" : undefined} aria-label="Leaderboard">
          <TrophyIcon />
        </Link>
      ) : null}
      {connected && !isGuest ? (
        <span className="mobile-tab-avatar" data-active={pathname === "/profil"}>
          <ProfileButton
            name={session.effectiveName}
            needsOnboarding={session.needsOnboarding}
            preset={session.avatarPreset}
            avatarVersion={session.avatarVersion}
          />
        </span>
      ) : (
        <Link href={isGuest ? "/profil" : "/connexion"} className="mobile-tab" data-active={pathname === "/profil"} aria-label={isGuest ? "Profil invité" : "Connexion"}>
          <UserIcon />
        </Link>
      )}
    </nav>
  );
}
