import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { HomeHeroBackground } from "@/components/home-hero-background";
import { SiteHeader } from "@/components/site-header";
import { PUBLIC_GAMES } from "@/games/registry";
import { getAuthenticatedAccount } from "@/server/auth";
import { avatarCacheVersion } from "@/server/avatar";
import { getProfileHistoryPage } from "@/app/historique/_data";
import { getPlayerGameStats, getPublicProfile } from "@/server/profiles/repository";
import { AccountHeader } from "@/components/account-header";
import { ProfileHistory } from "../profile-history";
import { ProfilePublic } from "../profile-public";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const GAME_OPTIONS = PUBLIC_GAMES.map(({ slug, cardName }) => ({ slug, displayName: cardName }));
const GAME_LABELS = new Map(PUBLIC_GAMES.map(({ slug, cardName }) => [slug, cardName]));

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const account = await getAuthenticatedAccount();
  if (!account) {
    return <main className="min-h-screen"><SiteHeader /><div className="mx-auto max-w-xl px-5 py-16 text-center"><h1 className="text-4xl font-black">Profil privé</h1><p className="mt-4 text-[var(--muted)]">Connecte-toi pour consulter ce profil.</p><Link href="/connexion" className="mt-7 inline-flex rounded-full bg-[var(--green)] px-5 py-3 font-bold text-white">Se connecter</Link></div></main>;
  }
  if (account.isGuest) {
    return <main className="min-h-screen"><SiteHeader /><div className="mx-auto max-w-xl px-5 py-16 text-center"><h1 className="text-4xl font-black">Profil réservé aux comptes</h1><p className="mt-4 text-[var(--muted)]">Les invités n&apos;ont pas de profil consultable.</p><Link href="/connexion?mode=signUp" className="mt-7 inline-flex rounded-full bg-[var(--green)] px-5 py-3 font-bold text-white">Créer un compte</Link></div></main>;
  }

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  if (id === account.member.id) redirect("/profil");

  const [profile, history] = await Promise.all([
    getPublicProfile(id),
    getProfileHistoryPage(account.member.id, id),
  ]);
  if (!profile) notFound();
  const stats = await getPlayerGameStats(id).catch(() => []);

  return (
    <div className="pf-page">
      <HomeHeroBackground />
      <AccountHeader
        name={account.member.effectiveName}
        needsOnboarding={account.member.needsOnboarding}
        preset={account.member.avatarPreset}
        avatarVersion={avatarCacheVersion(account.member.avatarPath)}
      />
      <div className="pf-layout">
        <div className="pf-col-profile">
          <ProfilePublic profile={profile} stats={stats} gameLabels={GAME_LABELS} />
        </div>
        <div className="pf-col-history">
          <ProfileHistory
            endpoint={`/api/profiles/${id}/history`}
            initialEntries={history.entries}
            initialNextCursor={history.nextCursor}
            games={GAME_OPTIONS}
            title={`Historique de ${profile.name}`}
            subtitle="Toutes ses parties terminées ; le détail reste réservé aux participants."
            emptyLabel="Aucune partie terminée pour le moment."
          />
        </div>
      </div>
    </div>
  );
}
