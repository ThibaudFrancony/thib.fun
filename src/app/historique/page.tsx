import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { PUBLIC_GAMES } from "@/games/registry";
import { getAuthenticatedAccount } from "@/server/auth";
import { getHistoryPage } from "./_data";
import { HistoryBrowser } from "./history-browser";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const account = await getAuthenticatedAccount();
  if (!account) {
    return <main className="min-h-screen"><SiteHeader /><div className="mx-auto max-w-xl px-5 py-16 text-center"><h1 className="text-4xl font-black">Historique privé</h1><p className="mt-4 text-[var(--muted)]">Connecte-toi pour retrouver vos parties.</p><Link href="/connexion" className="mt-7 inline-flex rounded-full bg-[var(--green)] px-5 py-3 font-bold text-white">Se connecter</Link></div></main>;
  }
  if (account.isGuest) {
    return <main className="min-h-screen"><SiteHeader /><div className="mx-auto max-w-xl px-5 pb-16 pt-8 sm:px-8"><Link href="/" className="text-sm font-bold text-[var(--muted)]">← Jeux</Link><section className="mt-8 rounded-[1.5rem] border border-[var(--line)] bg-[var(--card)] p-6 text-center shadow-[0_12px_30px_rgba(20,33,29,0.06)] sm:p-8"><p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--orange)]">Mode invité</p><h1 className="mt-3 text-4xl font-black tracking-[-0.05em]">Pas d&apos;historique en invité</h1><p className="mt-4 leading-7 text-[var(--muted)]">Tes parties restent disponibles pendant la session, mais ta progression n&apos;est pas sauvegardée. Crée un compte pour conserver tes prochaines confrontations.</p><Link href="/connexion?mode=signUp" className="mt-7 inline-flex min-h-11 items-center rounded-full bg-[var(--green)] px-5 py-3 font-bold text-white">Créer un compte</Link></section></div></main>;
  }
  const history = await getHistoryPage(account.member.id);
  return <main className="min-h-screen"><SiteHeader /><div className="mx-auto max-w-4xl px-5 pb-16 pt-8 sm:px-8"><Link href="/" className="text-sm font-bold text-[var(--muted)]">← Jeux</Link><div className="mt-8"><p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--orange)]">Vos confrontations</p><h1 className="mt-2 text-5xl font-black tracking-[-0.05em]">Historique</h1><p className="mt-4 text-[var(--muted)]">Les résultats sont conservés séparément pour chaque membre. Les parties interrompues et les résultats communs restent distincts.</p></div><HistoryBrowser initialEntries={history.entries} initialNextCursor={history.nextCursor} games={PUBLIC_GAMES.map(({ slug, displayName }) => ({ slug, displayName }))} /></div></main>;
}
