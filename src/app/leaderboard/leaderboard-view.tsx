import Image from "next/image";
import { Avatar } from "@/components/avatar";
import type { LeaderboardEntry, LeaderboardMe } from "@/lib/leaderboard-types";

function formatPoints(points: number): string {
  return `${points} pt${points > 1 ? "s" : ""}`;
}

function formatRecord(entry: { wins: number; losses: number; draws: number }): string {
  return `${entry.wins} V · ${entry.losses} D · ${entry.draws} N`;
}

const PODIUM_ASSETS: Record<1 | 2 | 3, { src: string; className: string }> = {
  1: { src: "/leaderboard/crown.png", className: "lb-crown" },
  2: { src: "/leaderboard/badge-2.png", className: "lb-badge" },
  3: { src: "/leaderboard/badge-3.png", className: "lb-badge" },
};

function PodiumCard({ entry, place }: { entry: LeaderboardEntry | null; place: 1 | 2 | 3 }) {
  const asset = PODIUM_ASSETS[place];
  return (
    <article className="lb-card" data-place={place} data-empty={entry ? undefined : "true"}>
      {entry ? (
        <Image
          className={asset.className}
          src={asset.src}
          alt=""
          aria-hidden="true"
          width={1254}
          height={1254}
          priority={place === 1}
        />
      ) : null}
      <div className="lb-card-avatar">
        {entry ? (
          <Avatar name={entry.name} preset={entry.avatarPreset} imageUrl={entry.avatarUrl} size={place === 1 ? 96 : 72} />
        ) : (
          <span className="lb-card-avatar-empty" aria-hidden="true">—</span>
        )}
      </div>
      <p className="lb-card-place">{place === 1 ? "1ER" : `${place}E`}</p>
      <p className="lb-card-name">{entry?.name ?? "En attente"}</p>
      <p className="lb-card-points">{entry ? formatPoints(entry.points) : "—"}</p>
      {entry ? <p className="lb-card-record">{formatRecord(entry)}</p> : null}
    </article>
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
  const meVisible = me ? entries.some((entry) => entry.userId === viewerId) : false;

  return (
    <div className="lb-root">
      <section className="lb-podium" aria-label="Podium des trois premiers">
        {podium.map((place) => (
          <PodiumCard key={place} place={place} entry={entries[place - 1] ?? null} />
        ))}
      </section>

      <section className="lb-panel" aria-label="Classement des cent premiers joueurs">
        <header className="lb-panel-head">
          <h2 className="lb-panel-title">Top 100</h2>
          <p className="lb-panel-sub">10 points par victoire, 5 par défaite, 7 par match nul, 10 par réussite coopérative.</p>
        </header>
        {entries.length === 0 ? (
          <p className="lb-empty">Aucun point marqué pour le moment. Joue une partie pour ouvrir le classement !</p>
        ) : (
          <div className="lb-table-wrap">
            <table className="lb-table">
              <thead>
                <tr>
                  <th scope="col" className="lb-cell-rank">#</th>
                  <th scope="col">Joueur</th>
                  <th scope="col" className="lb-col-record">Bilan</th>
                  <th scope="col" className="lb-cell-points">Points</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.userId}
                    data-me={entry.userId === viewerId}
                    data-rank={entry.rank <= 3 ? entry.rank : undefined}
                  >
                    <td className="lb-cell-rank">{entry.rank}</td>
                    <td>
                      <span className="lb-cell-player">
                        <Avatar name={entry.name} preset={entry.avatarPreset} imageUrl={entry.avatarUrl} size={34} />
                        <span className="lb-cell-name">{entry.name}</span>
                      </span>
                    </td>
                    <td className="lb-cell-record lb-col-record">{formatRecord(entry)}</td>
                    <td className="lb-cell-points">{entry.points} pts</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
