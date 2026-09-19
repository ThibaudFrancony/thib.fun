import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getAuthenticatedAccount } from "@/server/auth";
import { getLeaderboard } from "@/server/leaderboard/repository";
import type { LeaderboardPayload } from "@/lib/leaderboard-types";
import { LeaderboardView } from "./leaderboard-view";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const account = await getAuthenticatedAccount();

  if (!account || account.isGuest) {
    return (
      <main className="lb-page">
        <SiteHeader variant="space" />
        <div className="lb-content">
          <Link href="/" className="lb-back">← Jeux</Link>
          <section className="lb-state">
            <p className="lb-eyebrow">{account ? "Mode invité" : "Classement général"}</p>
            <h1 className="lb-state-title">{account ? "Pas de classement en invité" : "Leaderboard"}</h1>
            <p className="lb-state-text">
              {account
                ? "Les points sont réservés aux comptes permanents. Crée un compte pour apparaître dans le leaderboard."
                : "Connecte-toi pour voir le classement des joueurs."}
            </p>
            <Link className="lb-cta" href={account ? "/connexion?mode=signUp" : "/connexion"}>
              {account ? "Créer un compte" : "Se connecter"}
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
    <main className="lb-page">
      <SiteHeader variant="space" />
      <div className="lb-content">
        <Link href="/" className="lb-back">← Jeux</Link>
        <header className="lb-heading">
          <p className="lb-eyebrow">Classement général</p>
          <h1 className="lb-title">Leaderboard</h1>
          <p className="lb-subtitle">
            Tous les jeux confondus : chaque partie terminée rapporte des points aux comptes permanents. Les égalités et
            les réussites coopératives comptent aussi.
          </p>
        </header>
        {leaderboard ? (
          <LeaderboardView entries={leaderboard.entries} me={leaderboard.me} viewerId={account.member.id} />
        ) : (
          <p className="lb-empty">Le classement est momentanément indisponible. Réessaie dans un instant.</p>
        )}
      </div>
    </main>
  );
}
