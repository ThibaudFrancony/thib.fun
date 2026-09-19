import { Avatar } from "@/components/avatar";
import type { LeaderboardEntry, LeaderboardMe } from "@/lib/leaderboard-types";

function formatPoints(points: number): string {
  return `${points} pt${points > 1 ? "s" : ""}`;
}

function formatRecord(entry: { wins: number; losses: number; draws: number }): string {
  return `${entry.wins} V · ${entry.losses} D · ${entry.draws} N`;
}

function PodiumSlot({ entry, place }: { entry: LeaderboardEntry | null; place: 1 | 2 | 3 }) {
  return (
    <div className="lb-podium-slot" data-place={place}>
      <div className="lb-podium-avatar">
        {entry ? (
          <Avatar name={entry.name} preset={entry.avatarPreset} imageUrl={entry.avatarUrl} size={place === 1 ? 84 : 68} />
        ) : (
          <span className="lb-podium-empty" aria-hidden="true">
            —
          </span>
        )}
      </div>
      <p className="lb-podium-place">{place === 1 ? "1er" : `${place}e`}</p>
      <p className="lb-podium-name">{entry?.name ?? "En attente"}</p>
      <p className="lb-podium-points">{entry ? formatPoints(entry.points) : "—"}</p>
    </div>
  );
}

export function LeaderboardView({
  entries,
  me,
  viewerId,
}: {
  entries: LeaderboardEntry[];
  me: LeaderboardMe | null;
  viewerId: string;
}) {
  const podium = [2, 1, 3] as const;
  const rest = entries.slice(3);
  const meVisible = me ? entries.some((entry) => entry.userId === viewerId) : false;

  return (
    <div className="lb-root">
      <section className="lb-podium" aria-label="Podium des trois premiers">
        {podium.map((place) => (
          <PodiumSlot key={place} place={place} entry={entries[place - 1] ?? null} />
        ))}
      </section>

      <section className="lb-list" aria-label="Classement des cent premiers joueurs">
        <div className="lb-list-head">
          <h2 className="lb-list-title">Top 100</h2>
          <p className="lb-list-sub">10 points par victoire, 5 par défaite, 7 par match nul, 10 par réussite coopérative.</p>
        </div>
        {entries.length === 0 ? (
          <p className="lb-empty">Aucun point marqué pour le moment. Joue une partie pour ouvrir le classement !</p>
        ) : rest.length > 0 ? (
          <ol className="lb-rows">
            {rest.map((entry) => (
              <li key={entry.userId} className="lb-row" data-me={entry.userId === viewerId}>
                <span className="lb-rank">{entry.rank}</span>
                <Avatar name={entry.name} preset={entry.avatarPreset} imageUrl={entry.avatarUrl} size={34} />
                <span className="lb-name">{entry.name}</span>
                <span className="lb-record">{formatRecord(entry)}</span>
                <span className="lb-points">{formatPoints(entry.points)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="lb-empty">Le podium occupe les trois premières places. Reviens quand d&apos;autres joueurs marquent des points !</p>
        )}
      </section>

      {me && !meVisible ? (
        <section className="lb-me" aria-label="Ton rang">
          <span className="lb-me-label">Ton rang</span>
          <strong className="lb-me-rank">#{me.rank}</strong>
          <span className="lb-me-points">{formatPoints(me.points)}</span>
          <span className="lb-me-record">{formatRecord(me)}</span>
        </section>
      ) : null}
      {!me && entries.length > 0 ? (
        <p className="lb-me-empty">Tu n&apos;as pas encore de point : termine une partie classée pour entrer au classement.</p>
      ) : null}
    </div>
  );
}
