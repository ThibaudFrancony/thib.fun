import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { RoomJoin } from "@/games/geographie/components/geography-setup";
import { BombpartySetup } from "@/games/bombparty/components/bombparty-setup";

export default function BombpartyPage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-5 pb-16 pt-8 sm:px-8">
        <Link href="/" className="text-sm font-bold text-[var(--muted)] hover:text-[var(--ink)]">← Tous les jeux</Link>
        <div className="mt-8 grid gap-8 md:grid-cols-[1fr_420px] md:items-start">
          <section>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#6d28d9]">Syllabe Express · BombParty</p>
            <h1 className="mt-3 text-5xl font-black leading-[0.95] tracking-[-0.06em]">Le bon mot avant la fin du chrono.</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted)]">Une séquence s&apos;affiche, propose un mot qui la contient. Chaque mot valide passe la main et raccourcit le chrono.</p>
            <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
              <Fact title="3 ou 5 vies" text="Le chrono coûte cher" />
              <Fact title="200 tours max" text="Vies puis mots" />
              <Fact title="Dictionnaire fixe" text="Aucune aide en match" />
            </div>
            <p className="mt-6 max-w-xl text-sm leading-6 text-[var(--muted)]">
              Pour t&apos;échauffer sans enjeu, rendez-vous à l&apos;entraînement solo :{" "}
              <Link href="/entrainement/syllabes" className="font-bold text-[#6d28d9] hover:underline">Syllabes en solo</Link>.
            </p>
          </section>
          <div className="space-y-5"><BombpartySetup /><RoomJoin /></div>
        </div>
      </div>
    </main>
  );
}

function Fact({ title, text }: { title: string; text: string }) {
  return <div className="rounded-2xl border border-[var(--line)] bg-white/60 p-4"><p className="font-black">{title}</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{text}</p></div>;
}
