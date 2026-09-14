import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { PUBLIC_GAMES } from "@/games/registry";
import { getAuthenticatedAccount } from "@/server/auth";
import { getPairHistoryPage } from "../../_data";
import { PairHistoryBrowser } from "../../pair-history-browser";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export default async function PairHistoryPage({ params }: { params: Promise<{ playerId: string }> }) {
  const account = await getAuthenticatedAccount();
  if (!account) {
    return <main className="min-h-screen"><SiteHeader /><div className="mx-auto max-w-xl px-5 py-16 text-center"><h1 className="text-4xl font-black">Historique privé</h1><p className="mt-4 text-[var(--muted)]">Connecte-toi pour consulter cet historique.</p><Link href="/connexion" className="mt-7 inline-flex rounded-full bg-[var(--green)] px-5 py-3 font-bold text-white">Se connecter</Link></div></main>;
  }
  if (account.isGuest) {
    return <main className="min-h-screen"><SiteHeader /><div className="mx-auto max-w-xl px-5 py-16 text-center"><h1 className="text-4xl font-black">Historique réservé aux comptes</h1><p className="mt-4 text-[var(--muted)]">Les invités ne disposent pas d&apos;agrégats persistants.</p><Link href="/connexion?mode=signUp" className="mt-7 inline-flex rounded-full bg-[var(--green)] px-5 py-3 font-bold text-white">Créer un compte</Link></div></main>;
  }

  const { playerId } = await params;
  if (!UUID_PATTERN.test(playerId) || playerId === account.member.id) notFound();

  let pair;
  try {
    pair = await getPairHistoryPage(account.member.id, playerId);
  } catch {
    return <main className="min-h-screen"><SiteHeader /><div className="mx-auto max-w-xl px-5 py-16 text-center"><h1 className="text-4xl font-black">Historique indisponible</h1><p className="mt-4 text-[var(--muted)]">Les statistiques de ce duo ne sont pas accessibles pour le moment.</p><Link href="/historique" className="mt-7 inline-flex rounded-full bg-[var(--green)] px-5 py-3 font-bold text-white">Retour à l&apos;historique</Link></div></main>;
  }

  return <main className="min-h-screen"><SiteHeader /><div className="mx-auto max-w-4xl px-5 pb-16 pt-8 sm:px-8"><Link href="/historique" className="text-sm font-bold text-[var(--muted)]">← Historique</Link><p className="mt-8 text-sm font-bold uppercase tracking-[0.16em] text-[var(--orange)]">Confrontations privées</p><h1 className="mt-3 text-5xl font-black tracking-[-0.06em]">Toi contre {pair.opponentPseudo}</h1><p className="mt-4 text-[var(--muted)]">Les victoires, égalités, sessions coopératives et interruptions restent comptées séparément.</p><PairHistoryBrowser playerId={playerId} initialOpponentPseudo={pair.opponentPseudo} initialStats={pair.stats} initialEntries={pair.entries} initialNextCursor={pair.nextCursor} games={PUBLIC_GAMES.map(({ slug, displayName }) => ({ slug, displayName }))} /></div></main>;
}
