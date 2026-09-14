import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getAuthenticatedAccount } from "@/server/auth";
import { getHistoryDetail } from "../_data";
import { HistoryDetailView } from "../history-detail";

export const dynamic = "force-dynamic";

export default async function HistoryDetailPage({ params }: { params: Promise<{ matchId: string }> }) {
  const account = await getAuthenticatedAccount();
  if (!account) return <main className="min-h-screen"><SiteHeader /><div className="mx-auto max-w-xl px-5 py-16 text-center"><h1 className="text-4xl font-black">Historique privé</h1><p className="mt-4 text-[var(--muted)]">Connecte-toi pour consulter ce résultat.</p><Link href="/connexion" className="mt-7 inline-flex rounded-full bg-[var(--green)] px-5 py-3 font-bold text-white">Se connecter</Link></div></main>;
  if (account.isGuest) return <main className="min-h-screen"><SiteHeader /><div className="mx-auto max-w-xl px-5 py-16 text-center"><h1 className="text-4xl font-black">Historique réservé aux comptes</h1><p className="mt-4 text-[var(--muted)]">Les invités peuvent jouer, mais leurs résultats ne sont pas conservés.</p><Link href="/connexion?mode=signUp" className="mt-7 inline-flex rounded-full bg-[var(--green)] px-5 py-3 font-bold text-white">Créer un compte</Link></div></main>;
  const { matchId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(matchId)) notFound();
  const detail = await getHistoryDetail(account.member.id, matchId);
  if (!detail) notFound();
  return <><SiteHeader /><HistoryDetailView detail={detail} /></>;
}
