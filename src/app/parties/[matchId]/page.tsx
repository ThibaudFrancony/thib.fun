import { MatchGame } from "@/components/match-game";

// Partie temps réel : strictement dynamique et personnelle (projection
// `project(state, viewerId)` par joueur). Ne jamais mettre en cache partagé.
export const dynamic = "force-dynamic";

export default async function MatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  return <MatchGame matchId={matchId} />;
}
