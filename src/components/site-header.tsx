import Link from "next/link";
import { getAuthenticatedAccount } from "@/server/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { ProfileButton } from "@/components/profile-button";
import { SalonLauncher } from "@/components/salon-dialog";

export async function SiteHeader({ variant = "default" }: { variant?: "default" | "home" | "geo" }) {
  const account = await getAuthenticatedAccount();

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
        <nav className="home-auth-nav" aria-label="Accès au compte">
          <SalonLauncher connected={Boolean(account)} />
          {account ? account.isGuest ? <><span className="home-auth-link" aria-label={`Invité ${account.member.pseudo}`}>Invité · {account.member.pseudo}</span><Link href="/connexion?mode=signUp" className="home-auth-link home-signup-link">Créer un compte</Link><SignOutButton className="home-auth-link" /></> : <><ProfileButton name={account.member.effectiveName} accountName={account.member.accountName} needsOnboarding={account.member.needsOnboarding} preset={account.member.avatarPreset} hasAvatar={account.member.avatarPath !== null} /><SignOutButton className="home-auth-link" /></> : <><Link href="/connexion" className="home-auth-link">Connexion</Link><Link href="/connexion?mode=signUp" className="home-auth-link home-signup-link">Inscription</Link></>}
        </nav>
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
        <nav className="geo-nav" aria-label="Navigation principale">
          <Link className="geo-nav-link" href="/">Jeux</Link>
          <Link className="geo-nav-link" href="/historique">Historique</Link>
          {account ? account.isGuest ? <><span className="geo-nav-link" aria-label={`Invité ${account.member.pseudo}`}>Invité · {account.member.pseudo}</span><Link className="geo-nav-link" href="/connexion?mode=signUp">Créer un compte</Link><SignOutButton className="geo-nav-link" /></> : <><ProfileButton name={account.member.effectiveName} accountName={account.member.accountName} needsOnboarding={account.member.needsOnboarding} preset={account.member.avatarPreset} hasAvatar={account.member.avatarPath !== null} /><SignOutButton className="geo-nav-link" /></> : <Link className="geo-nav-link" href="/connexion">Connexion</Link>}
        </nav>
      </header>
    );
  }

  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
      <Link href="/" className="flex items-center gap-3" aria-label="Accueil tibo.fun">
        <span className="grid size-10 place-items-center rounded-2xl bg-[var(--green)] text-lg font-black text-white shadow-[4px_4px_0_var(--orange)]">t</span>
        <span className="text-lg font-black tracking-tight">tibo.fun</span>
      </Link>
      <nav className="flex items-center gap-2 text-sm font-semibold text-[var(--muted)]" aria-label="Navigation principale">
        <Link className="rounded-full px-3 py-2 hover:bg-white/70 hover:text-[var(--ink)]" href="/">Jeux</Link>
        <Link className="rounded-full px-3 py-2 hover:bg-white/70 hover:text-[var(--ink)]" href="/historique">Historique</Link>
        {account ? account.isGuest ? <><span className="rounded-full px-3 py-2 text-[var(--muted)]" aria-label={`Invité ${account.member.pseudo}`}>Invité · {account.member.pseudo}</span><Link className="rounded-full px-3 py-2 hover:bg-white/70 hover:text-[var(--ink)]" href="/connexion?mode=signUp">Créer un compte</Link><SignOutButton className="rounded-full px-3 py-2 hover:bg-white/70 hover:text-[var(--ink)]" /></> : <><ProfileButton name={account.member.effectiveName} accountName={account.member.accountName} needsOnboarding={account.member.needsOnboarding} preset={account.member.avatarPreset} hasAvatar={account.member.avatarPath !== null} /><SignOutButton className="rounded-full px-3 py-2 hover:bg-white/70 hover:text-[var(--ink)]" /></> : <Link className="rounded-full px-3 py-2 hover:bg-white/70 hover:text-[var(--ink)]" href="/connexion">Connexion</Link>}
      </nav>
    </header>
  );
}
