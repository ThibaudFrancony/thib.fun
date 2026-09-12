import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { PUBLIC_GAMES } from "@/games/registry";
import { getAuthenticatedAccount } from "@/server/auth";
import { getHistory } from "@/server/matches/repository";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const account = await getAuthenticatedAccount();
  if (!account) {
    return <main className="min-h-screen"><SiteHeader /><div className="mx-auto max-w-xl px-5 py-16 text-center"><h1 className="text-4xl font-black">Historique privé</h1><p className="mt-4 text-[var(--muted)]">Connecte-toi pour retrouver vos parties.</p><Link href="/connexion" className="mt-7 inline-flex rounded-full bg-[var(--green)] px-5 py-3 font-bold text-white">Se connecter</Link></div></main>;
  }
  if (account.isGuest) {
    return <main className="min-h-screen"><SiteHeader /><div className="mx-auto max-w-xl px-5 pb-16 pt-8 sm:px-8"><Link href="/" className="text-sm font-bold text-[var(--muted)]">← Jeux</Link><section className="mt-8 rounded-[1.5rem] border border-[var(--line)] bg-[var(--card)] p-6 text-center shadow-[0_12px_30px_rgba(20,33,29,0.06)] sm:p-8"><p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--orange)]">Mode invité</p><h1 className="mt-3 text-4xl font-black tracking-[-0.05em]">Pas d&apos;historique en invité</h1><p className="mt-4 leading-7 text-[var(--muted)]">Tes parties restent disponibles pendant la session, mais ta progression n&apos;est pas sauvegardée. Crée un compte pour conserver tes prochaines confrontations.</p><Link href="/connexion?mode=signUp" className="mt-7 inline-flex min-h-11 items-center rounded-full bg-[var(--green)] px-5 py-3 font-bold text-white">Créer un compte</Link></section></div></main>;
  }
  const history = await getHistory(account.member.id);
  return <main className="min-h-screen"><SiteHeader /><div className="mx-auto max-w-4xl px-5 pb-16 pt-8 sm:px-8"><Link href="/" className="text-sm font-bold text-[var(--muted)]">← Jeux</Link><div className="mt-8"><p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--orange)]">Vos confrontations</p><h1 className="mt-2 text-5xl font-black tracking-[-0.05em]">Historique</h1><p className="mt-4 text-[var(--muted)]">Les résultats sont conservés séparément pour chaque membre.</p></div>{history.entries.length === 0 ? <div className="mt-10 rounded-3xl border border-dashed border-[var(--line)] bg-white/60 p-8 text-center text-[var(--muted)]">Aucune partie terminée pour le moment.</div> : <div className="mt-10 grid gap-3">{history.entries.map((entry) => { const game = PUBLIC_GAMES.find((item) => item.slug === entry.gameSlug); const result = entry.outcome === "draw" ? "Égalité" : entry.outcome === "win" ? "Victoire" : entry.outcome === "abandoned" ? "Abandonnée" : "Défaite"; return <Link key={entry.matchId} href={`/parties/${entry.matchId}`} className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(20,33,29,0.07)]"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--orange)]">{game?.displayName ?? entry.gameSlug}</p><p className="mt-1 font-black">Face à ton partenaire</p></div><span className="rounded-full bg-[var(--green)]/10 px-3 py-1 text-sm font-bold text-[var(--green-dark)]">{result}</span></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--muted)]"><span>{new Date(entry.endedAt).toLocaleDateString("fr-FR", { dateStyle: "medium" })}</span><span className="font-black text-[var(--ink)]">{entry.score ?? "—"} – {entry.opponentScore ?? "—"}</span></div></Link>; })}</div>}</div></main>;
}
