import { MatchGame } from "@/components/match-game";

export default async function MatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  return <MatchGame matchId={matchId} />;
}
