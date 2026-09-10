import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { GeographySetup, RoomJoin } from "@/games/geographie/components/geography-setup";

export default function GeographySetupPage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-5 pb-16 pt-8 sm:px-8">
        <Link href="/" className="text-sm font-bold text-[var(--muted)] hover:text-[var(--ink)]">← Tous les jeux</Link>
        <div className="mt-8 grid gap-8 md:grid-cols-[1fr_420px] md:items-start">
          <section><p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--orange)]">HexaPoint · Géographie</p><h1 className="mt-3 text-5xl font-black leading-[0.95] tracking-[-0.06em]">La ville est là. À toi de viser juste.</h1><p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted)]">Deux placements par manche, une carte sans étiquette et un score qui récompense la précision. Les coordonnées ne partent qu’après ta confirmation.</p><div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3"><Fact title="2 joueurs" text="Un lien de salon privé" /><Fact title="5 à 15" text="Manches au choix" /><Fact title="France" text="Métropole + Corse" /></div></section>
          <div className="space-y-5"><GeographySetup /><RoomJoin /></div>
        </div>
      </div>
    </main>
  );
}

function Fact({ title, text }: { title: string; text: string }) {
  return <div className="rounded-2xl border border-[var(--line)] bg-white/60 p-4"><p className="font-black">{title}</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{text}</p></div>;
}
