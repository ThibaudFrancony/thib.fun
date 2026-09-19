import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getAuthenticatedAccount } from "@/server/auth";
import { getLeaderboard } from "@/server/leaderboard/repository";
import type { LeaderboardPayload } from "@/lib/leaderboard-types";
import { LeaderboardView } from "./leaderboard-view";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const account = await getAuthenticatedAccount();
  if (!account) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-xl px-5 py-16 text-center">
          <h1 className="text-4xl font-black">Leaderboard</h1>
          <p className="mt-4 text-[var(--muted)]">Connecte-toi pour voir le classement des joueurs.</p>
          <Link href="/connexion" className="mt-7 inline-flex rounded-full bg-[var(--green)] px-5 py-3 font-bold text-white">
            Se connecter
          </Link>
        </div>
      </main>
    );
  }
  if (account.isGuest) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-xl px-5 pb-16 pt-8 sm:px-8">
          <Link href="/" className="text-sm font-bold text-[var(--muted)]">
            ← Jeux
          </Link>
          <section className="mt-8 rounded-[1.5rem] border border-[var(--line)] bg-[var(--card)] p-6 text-center shadow-[0_12px_30px_rgba(20,33,29,0.06)] sm:p-8">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--orange)]">Mode invité</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.05em]">Pas de classement en invité</h1>
            <p className="mt-4 leading-7 text-[var(--muted)]">
              Les points sont réservés aux comptes permanents. Crée un compte pour apparaître dans le leaderboard.
            </p>
            <Link
              href="/connexion?mode=signUp"
              className="mt-7 inline-flex min-h-11 items-center rounded-full bg-[var(--green)] px-5 py-3 font-bold text-white"
            >
              Créer un compte
            </Link>
          </section>
        </div>
      </main>
    );
  }

  let leaderboard: LeaderboardPayload | null = null;
  try {
    leaderboard = await getLeaderboard(account.member.id);
  } catch {
    leaderboard = null;
  }

  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-5 pb-16 pt-8 sm:px-8">
        <Link href="/" className="text-sm font-bold text-[var(--muted)]">
          ← Jeux
        </Link>
        <div className="mt-8">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--orange)]">Classement général</p>
          <h1 className="mt-2 text-5xl font-black tracking-[-0.05em]">Leaderboard</h1>
          <p className="mt-4 text-[var(--muted)]">
            Tous les jeux confondus : chaque partie terminée rapporte des points aux comptes permanents. Les égalités et
            les réussites coopératives comptent aussi.
          </p>
        </div>
        {leaderboard ? (
          <LeaderboardView entries={leaderboard.entries} me={leaderboard.me} viewerId={account.member.id} />
        ) : (
          <p className="lb-empty">Le classement est momentanément indisponible. Réessaie dans un instant.</p>
        )}
      </div>
    </main>
  );
}
