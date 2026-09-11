import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { RoomJoin } from "@/games/geographie/components/geography-setup";
import { BatailleNavaleSetup } from "@/games/bataille-navale/components/bataille-navale-setup";

export default function BatailleNavalePage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-5 pb-16 pt-8 sm:px-8">
        <Link href="/" className="text-sm font-bold text-[var(--muted)] hover:text-[var(--ink)]">← Tous les jeux</Link>
        <div className="mt-8 grid gap-8 md:grid-cols-[1fr_420px] md:items-start">
          <section>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#6d28d9]">Flotte cachée · Bataille navale</p>
            <h1 className="mt-3 text-5xl font-black leading-[0.95] tracking-[-0.06em]">Repère et coule la flotte adverse.</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted)]">Cinq bateaux, 17 cases, un tir par tour. Toucher ne fait pas rejouer.</p>
            <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
              <Fact title="5 bateaux" text="17 cases au total" />
              <Fact title="10 × 10" text="Lignes A–J, colonnes 1–10" />
              <Fact title="1 tir / tour" text="Sans rejouer" />
            </div>
          </section>
          <div className="space-y-5"><BatailleNavaleSetup /><RoomJoin /></div>
        </div>
      </div>
    </main>
  );
}

function Fact({ title, text }: { title: string; text: string }) {
  return <div className="rounded-2xl border border-[var(--line)] bg-white/60 p-4"><p className="font-black">{title}</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{text}</p></div>;
}
