import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { RoomLobby } from "./room-lobby";

// Salon temps réel : strictement dynamique et personnel (projection privée,
// Realtime, heartbeat). Ne jamais mettre en cache partagé.
export const dynamic = "force-dynamic";

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <main className="geo-page geo-room-page"><SiteHeader variant="geo" /><div className="geo-content geo-room-content"><Link href="/" className="geo-back-link">← Accueil</Link><RoomLobby roomId={roomId} roomManagementEnabled={process.env.ROOM_CHANGE_RPC_ENABLED === "true"} /></div></main>;
}
