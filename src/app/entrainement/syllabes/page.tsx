import Link from "next/link";
import { SiteHeaderCached } from "@/components/site-header-cached";
import { TrainingSyllabes } from "@/games/bombparty/components/training-syllabes";

// Page statique : l'entraînement charge le dictionnaire côté client au fil de
// la frappe, le compte est lu par l'îlot `SiteHeaderAuth`.
export const dynamic = "force-static";

export default function TrainingSyllabesPage() {
  return (
    <main className="table-page table-bombparty">
      <SiteHeaderCached />
      <div className="mx-auto max-w-3xl px-5 pb-16 pt-8 sm:px-8">
        <Link href="/jeux/bombparty" className="text-sm font-bold text-[var(--muted)] hover:text-[var(--ink)]">← Syllabe Express</Link>
        <p className="mt-8 text-sm font-bold uppercase tracking-[0.16em] table-accent">Entraînement solo</p>
        <h1 className="mt-3 text-5xl font-black leading-[0.95] tracking-[-0.06em]">Syllabes en solo.</h1>
        <p className="mt-4 max-w-xl text-lg leading-8 text-[var(--muted)]">Échauffe-toi sur le dictionnaire officiel, en mode libre ou contre la montre. Aucun point de profil, aucune aide pendant un match en cours.</p>
        <div className="mt-8"><TrainingSyllabes /></div>
      </div>
    </main>
  );
}
