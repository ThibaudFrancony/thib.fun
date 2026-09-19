import Link from "next/link";
import { ProfileButton } from "@/components/profile-button";
import { SignOutButton } from "@/components/sign-out-button";

export function AccountHeader({
  name,
  needsOnboarding,
  preset,
  avatarVersion,
}: {
  name: string;
  needsOnboarding: boolean;
  preset: string;
  avatarVersion: string | null;
}) {
  return (
    <header className="pf-header">
      <Link href="/" className="pf-brand" aria-label="Accueil tibo.fun">
        <svg viewBox="0 0 32 32" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M10 9h12c3 0 5 3 6 7l1 6c.5 4-3 6-5 3l-4-4h-8l-4 4c-2 3-5.5 1-5-3l1-6c1-4 3-7 6-7Z" />
          <path d="M10 13v6m-3-3h6" />
          <circle cx="22" cy="14" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="25" cy="18" r="1.3" fill="currentColor" stroke="none" />
        </svg>
        <span>tibo.fun</span>
      </Link>
      <nav className="pf-nav" aria-label="Navigation principale">
        <Link className="pf-nav-link" href="/">Jeux</Link>
        <Link className="pf-nav-link lb-keep" href="/leaderboard">Leaderboard</Link>
        <ProfileButton
          name={name}
          needsOnboarding={needsOnboarding}
          preset={preset}
          avatarVersion={avatarVersion}
        />
        <SignOutButton className="pf-logout" />
      </nav>
    </header>
  );
}
