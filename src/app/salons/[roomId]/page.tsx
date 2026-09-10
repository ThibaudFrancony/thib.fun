import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { RoomLobby } from "@/components/room-lobby";

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <main className="geo-page geo-room-page"><SiteHeader variant="geo" /><div className="geo-content geo-room-content"><Link href="/" className="geo-back-link">← Accueil</Link><RoomLobby roomId={roomId} /></div></main>;
}
