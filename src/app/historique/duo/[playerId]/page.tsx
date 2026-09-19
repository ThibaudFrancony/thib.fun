import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export default async function LegacyPairHistoryPage({ params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  if (!UUID_PATTERN.test(playerId)) notFound();
  redirect(`/profil/${playerId}`);
}
