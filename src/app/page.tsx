import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { PUBLIC_GAMES } from "@/games/registry";

export default function HomePage() {
  const priority = PUBLIC_GAMES.filter((game) => game.priority === 0);
  const rest = PUBLIC_GAMES.filter((game) => game.priority === 1);
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="paper-grid mx-auto max-w-6xl rounded-[2rem] border border-white/70 px-5 pb-12 pt-10 shadow-sm sm:px-10 sm:pt-16">
        <section className="max-w-3xl">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-[var(--yellow)]/25 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-[var(--green-dark)]">
            Deux joueurs · un lien privé
          </p>
          <h1 className="max-w-2xl text-5xl font-black leading-[0.98] tracking-[-0.06em] sm:text-7xl">
            Votre petite table de jeux, même à distance.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted)]">
            Des parties courtes, des règles claires et un historique à vous deux. Le premier jeu disponible est Géographie.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/jeux/geographie" className="rounded-full bg-[var(--green)] px-5 py-3 font-bold text-white shadow-[4px_4px_0_var(--orange)] transition hover:-translate-y-0.5">Lancer Géographie</Link>
            <Link href="/connexion" className="rounded-full border border-[var(--line)] bg-white/70 px-5 py-3 font-bold hover:bg-white">Se connecter</Link>
          </div>
        </section>

        <section className="mt-16" aria-labelledby="priority-title">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div><p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--orange)]">À jouer maintenant</p><h2 id="priority-title" className="mt-1 text-3xl font-black tracking-tight">Les priorités</h2></div>
            <span className="hidden text-sm text-[var(--muted)] sm:block">Toujours deux places à la table</span>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {priority.map((game) => <GameCard key={game.slug} game={game} />)}
          </div>
        </section>

        <section className="mt-14" aria-labelledby="coming-title">
          <div className="mb-5"><p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--muted)]">La suite</p><h2 id="coming-title" className="mt-1 text-2xl font-black">Les autres jeux</h2></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((game) => <GameCard key={game.slug} game={game} compact />)}
          </div>
        </section>
      </div>
    </main>
  );
}

function GameCard({ game, compact = false }: { game: (typeof PUBLIC_GAMES)[number]; compact?: boolean }) {
  const available = game.availability !== "coming_soon";
  return (
    <article className={`rounded-[1.5rem] border border-[var(--line)] bg-[var(--card)] p-5 shadow-[0_12px_30px_rgba(20,33,29,0.06)] ${compact ? "min-h-44" : "min-h-64"}`}>
      <div className="flex items-start justify-between gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[var(--green)]/10 text-xl">{game.slug === "geographie" ? "⌖" : "✦"}</span><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${available ? "bg-[var(--green)]/10 text-[var(--green)]" : "bg-[var(--paper-deep)] text-[var(--muted)]"}`}>{available ? "Disponible" : "Bientôt"}</span></div>
      <h3 className="mt-6 text-2xl font-black tracking-tight">{game.displayName}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{game.description}</p>
      <div className="mt-5 flex items-center justify-between text-xs font-bold text-[var(--muted)]"><span>2 joueurs</span><span>{game.duration}</span></div>
      <div className="mt-5">{available ? <Link href="/jeux/geographie" className="inline-flex rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--green)]">Jouer</Link> : <span className="text-sm font-semibold text-[var(--muted)]">Préparation en cours</span>}</div>
    </article>
  );
}
