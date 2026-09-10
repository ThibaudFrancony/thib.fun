import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { RoomLobby } from "@/components/room-lobby";

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <main className="min-h-screen"><SiteHeader /><div className="mx-auto max-w-3xl px-5 pb-16 pt-8 sm:px-8"><Link href="/" className="text-sm font-bold text-[var(--muted)]">← Accueil</Link><RoomLobby roomId={roomId} /></div></main>;
}
