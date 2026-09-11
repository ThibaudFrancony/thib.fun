import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { RoomJoin } from "@/games/geographie/components/geography-setup";
import { CompatibiliteSetup } from "@/games/compatibilite/components/compatibilite-setup";

export default function CompatibilitePage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-5 pb-16 pt-8 sm:px-8">
        <Link href="/" className="text-sm font-bold text-[var(--muted)] hover:text-[var(--ink)]">← Tous les jeux</Link>
        <div className="mt-8 grid gap-8 md:grid-cols-[1fr_420px] md:items-start">
          <section>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#6d28d9]">Même réponse ? · Compatibilité</p>
            <h1 className="mt-3 text-5xl font-black leading-[0.95] tracking-[-0.06em]">Deux choix. Un point commun.</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted)]">Répondez chacun à votre rythme, puis découvrez ce qui vous rapproche — sans note psychologique, juste une partie légère à deux.</p>
            <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
              <Fact title="2 à 4 choix" text="Des questions originales" />
              <Fact title="3 passes" text="Pour changer de question" />
              <Fact title="100 % coop" text="Aucun gagnant ni perdant" />
            </div>
          </section>
          <div className="space-y-5"><CompatibiliteSetup /><RoomJoin /></div>
        </div>
      </div>
    </main>
  );
}

function Fact({ title, text }: { title: string; text: string }) {
  return <div className="rounded-2xl border border-[var(--line)] bg-white/60 p-4"><p className="font-black">{title}</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{text}</p></div>;
}
