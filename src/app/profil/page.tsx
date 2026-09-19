import Link from "next/link";
import { HomeHeroBackground } from "@/components/home-hero-background";
import { ProfileButton } from "@/components/profile-button";
import { SignOutButton } from "@/components/sign-out-button";
import { SiteHeader } from "@/components/site-header";
import { getAuthenticatedAccount } from "@/server/auth";
import { OnboardingPseudo } from "./onboarding-pseudo";
import { ProfileEditor } from "./profile-editor";

export const dynamic = "force-dynamic";

function ProfileHeader({
  name,
  accountName,
  needsOnboarding,
  preset,
  hasAvatar,
}: {
  name: string;
  accountName: string | null;
  needsOnboarding: boolean;
  preset: string;
  hasAvatar: boolean;
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
        <Link className="pf-nav-link" href="/historique">Historique</Link>
        <Link className="pf-nav-link lb-keep" href="/leaderboard">Leaderboard</Link>
        <ProfileButton
          name={name}
          accountName={accountName}
          needsOnboarding={needsOnboarding}
          preset={preset}
          hasAvatar={hasAvatar}
        />
        <SignOutButton className="pf-logout" />
      </nav>
    </header>
  );
}

export default async function ProfilePage() {
  const account = await getAuthenticatedAccount();
  if (!account) {
    return <main className="min-h-screen"><SiteHeader /><div className="mx-auto max-w-xl px-5 py-16 text-center"><h1 className="text-4xl font-black">Ton compte</h1><p className="mt-4 text-[var(--muted)]">Connecte-toi pour retrouver ton espace personnel.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link href="/connexion" className="inline-flex rounded-full bg-[var(--green)] px-5 py-3 font-bold text-white">Se connecter</Link><Link href="/profil/mot-de-passe" className="inline-flex rounded-full border border-[var(--line)] bg-white px-5 py-3 font-bold">Mot de passe oublié ?</Link></div></div></main>;
  }

  if (account.isGuest) {
    return <main className="min-h-screen"><SiteHeader /><div className="mx-auto max-w-xl px-5 pb-16 pt-8 sm:px-8"><Link href="/" className="text-sm font-bold text-[var(--muted)]">← Jeux</Link><section className="mt-8 rounded-[1.5rem] border border-[var(--line)] bg-[var(--card)] p-6 shadow-[0_12px_30px_rgba(20,33,29,0.06)] sm:p-8"><p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--orange)]">Mode invité</p><h1 className="mt-3 text-4xl font-black tracking-[-0.05em]">Tu joues sous le pseudo {account.member.pseudo}.</h1><p className="mt-5 leading-7 text-[var(--muted)]">Cette session te permet de rejoindre des salons et de jouer, mais ton pseudo, tes résultats et ta progression ne sont pas conservés dans un compte.</p><div className="mt-7 flex flex-wrap gap-3"><Link href="/connexion?mode=signUp" className="inline-flex min-h-11 items-center rounded-full bg-[var(--green)] px-5 py-3 font-bold text-white">Créer un compte</Link><Link href="/" className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] px-5 py-3 font-bold">Retour aux jeux</Link></div></section></div></main>;
  }

  if (account.member.needsOnboarding || !account.member.accountName) {
    return (
      <div className="pf-page">
        <HomeHeroBackground />
        <ProfileHeader
          name={account.member.effectiveName}
          accountName={account.member.accountName}
          needsOnboarding
          preset={account.member.avatarPreset}
          hasAvatar={false}
        />
        <main className="pf-main">
          <OnboardingPseudo />
        </main>
      </div>
    );
  }

  return (
    <div className="pf-page">
      <HomeHeroBackground />
      <ProfileHeader
        name={account.member.effectiveName}
        accountName={account.member.accountName}
        needsOnboarding={false}
        preset={account.member.avatarPreset}
        hasAvatar={account.member.avatarPath !== null}
      />
      <main className="pf-main">
        <ProfileEditor
          initialName={account.member.effectiveName}
          avatarPreset={account.member.avatarPreset}
          avatarPath={account.member.avatarPath}
        />
      </main>
    </div>
  );
}
