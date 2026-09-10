import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
      <Link href="/" className="flex items-center gap-3" aria-label="Accueil tibo.fun">
        <span className="grid size-10 place-items-center rounded-2xl bg-[var(--green)] text-lg font-black text-white shadow-[4px_4px_0_var(--orange)]">t</span>
        <span className="text-lg font-black tracking-tight">tibo.fun</span>
      </Link>
      <nav className="flex items-center gap-2 text-sm font-semibold text-[var(--muted)]" aria-label="Navigation principale">
        <Link className="rounded-full px-3 py-2 hover:bg-white/70 hover:text-[var(--ink)]" href="/">Jeux</Link>
        <Link className="rounded-full px-3 py-2 hover:bg-white/70 hover:text-[var(--ink)]" href="/historique">Historique</Link>
        <Link className="rounded-full px-3 py-2 hover:bg-white/70 hover:text-[var(--ink)]" href="/connexion">Connexion</Link>
      </nav>
    </header>
  );
}
