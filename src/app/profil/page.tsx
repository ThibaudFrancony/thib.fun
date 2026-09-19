import Link from "next/link";
import { HomeHeroBackground } from "@/components/home-hero-background";
import { SiteHeader } from "@/components/site-header";
import { PUBLIC_GAMES } from "@/games/registry";
import { getAuthenticatedAccount } from "@/server/auth";
import { avatarCacheVersion } from "@/server/avatar";
import { getProfileHistoryPage } from "@/app/historique/_data";
import { AccountHeader } from "@/components/account-header";
import { OnboardingPseudo } from "./onboarding-pseudo";
import { ProfileEditor } from "./profile-editor";
import { ProfileHistory } from "./profile-history";

export const dynamic = "force-dynamic";

const GAME_OPTIONS = PUBLIC_GAMES.map(({ slug, cardName }) => ({ slug, displayName: cardName }));

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
        <AccountHeader
          name={account.member.effectiveName}
          needsOnboarding
          preset={account.member.avatarPreset}
          avatarVersion={null}
        />
        <main className="pf-main">
          <OnboardingPseudo />
        </main>
      </div>
    );
  }

  const history = await getProfileHistoryPage(account.member.id, account.member.id);

  return (
    <div className="pf-page">
      <HomeHeroBackground />
      <AccountHeader
        name={account.member.effectiveName}
        needsOnboarding={false}
        preset={account.member.avatarPreset}
        avatarVersion={avatarCacheVersion(account.member.avatarPath)}
      />
      <div className="pf-layout">
        <div className="pf-col-profile">
          <ProfileEditor
            initialName={account.member.effectiveName}
            avatarPreset={account.member.avatarPreset}
            avatarVersion={avatarCacheVersion(account.member.avatarPath)}
          />
        </div>
        <div className="pf-col-history">
          <ProfileHistory
            endpoint={`/api/profiles/${account.member.id}/history`}
            initialEntries={history.entries}
            initialNextCursor={history.nextCursor}
            games={GAME_OPTIONS}
            title="Mon historique"
            subtitle="Tes parties terminées, filtrables par jeu et par issue."
            emptyLabel="Aucune partie terminée pour le moment."
          />
        </div>
      </div>
    </div>
  );
}
