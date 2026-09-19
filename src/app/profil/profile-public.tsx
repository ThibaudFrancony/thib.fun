import { Avatar } from "@/components/avatar";
import type { PlayerGameStat, PublicProfile } from "@/server/profiles/repository";

function total(rows: PlayerGameStat[], key: keyof Omit<PlayerGameStat, "gameSlug">): number {
  return rows.reduce((sum, row) => sum + row[key], 0);
}

export function ProfilePublic({ profile, stats, gameLabels }: { profile: PublicProfile; stats: PlayerGameStat[]; gameLabels: Map<string, string> }) {
  const played = total(stats, "played");
  const wins = total(stats, "wins");
  const losses = total(stats, "losses");
  const draws = total(stats, "draws");

  return (
    <section className="pf-card pf-public" aria-label={`Profil de ${profile.name}`}>
      <p className="pf-kicker">Profil joueur</p>
      <div className="pf-public-avatar">
        <Avatar name={profile.name} preset={profile.avatarPreset} imageUrl={profile.avatarUrl} size={150} emptyLabel="Sans photo" />
      </div>
      <h1 className="pf-title pf-public-name">{profile.name}</h1>
      <p className="pf-subtitle">Historique complet, parties interrompues incluses.</p>

      {played > 0 ? (
        <>
          <dl className="pf-public-stats">
            <div><dt>Parties</dt><dd>{played}</dd></div>
            <div><dt>Victoires</dt><dd>{wins}</dd></div>
            <div><dt>Défaites</dt><dd>{losses}</dd></div>
            <div><dt>Égalités</dt><dd>{draws}</dd></div>
          </dl>
          <ul className="pf-public-games">
            {stats.map((row) => (
              <li key={row.gameSlug}>
                <span className="pf-public-game">{gameLabels.get(row.gameSlug) ?? row.gameSlug}</span>
                <span className="pf-public-record">{row.wins} V · {row.losses} D{row.draws > 0 ? ` · ${row.draws} N` : ""}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="pf-public-empty">Aucune partie terminée pour le moment.</p>
      )}
    </section>
  );
}
