import { GeographyMatch } from "@/games/geographie/components/geography-match";

export default async function MatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  return <GeographyMatch matchId={matchId} />;
}
