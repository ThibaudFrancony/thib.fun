import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { RoomJoin } from "@/games/geographie/components/geography-setup";
import { UnoSetup } from "@/games/uno/components/uno-setup";

export default function UnoPage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-5 pb-16 pt-8 sm:px-8">
        <Link href="/" className="text-sm font-bold text-[var(--muted)] hover:text-[var(--ink)]">← Tous les jeux</Link>
        <div className="mt-8 grid gap-8 md:grid-cols-[1fr_420px] md:items-start">
          <section>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#b23853]">Dernière carte · UNO</p>
            <h1 className="mt-3 text-5xl font-black leading-[0.95] tracking-[-0.06em]">Pose tes cartes. Garde le rythme.</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted)]">Le UNO classique à deux, avec une table privée, un chrono serveur et une main adverse qui reste secrète jusqu&apos;à la fin.</p>
            <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
              <Fact title="108 cartes" text="Le paquet complet" />
              <Fact title="7 chacun" text="Distribution classique" />
              <Fact title="+4 contrôlé" text="Sans contestation" />
            </div>
          </section>
          <div className="space-y-5"><UnoSetup /><RoomJoin /></div>
        </div>
      </div>
    </main>
  );
}

function Fact({ title, text }: { title: string; text: string }) {
  return <div className="rounded-2xl border border-[var(--line)] bg-white/60 p-4"><p className="font-black">{title}</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{text}</p></div>;
}
