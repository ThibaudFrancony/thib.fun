import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getAuthenticatedAccount } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const account = await getAuthenticatedAccount();
  if (!account) {
    return <main className="min-h-screen"><SiteHeader /><div className="mx-auto max-w-xl px-5 py-16 text-center"><h1 className="text-4xl font-black">Ton compte</h1><p className="mt-4 text-[var(--muted)]">Connecte-toi pour retrouver ton espace personnel.</p><Link href="/connexion" className="mt-7 inline-flex rounded-full bg-[var(--green)] px-5 py-3 font-bold text-white">Se connecter</Link></div></main>;
  }

  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-5 pb-16 pt-8 sm:px-8">
        <Link href="/" className="text-sm font-bold text-[var(--muted)]">← Jeux</Link>
        <section className="mt-8 rounded-[1.5rem] border border-[var(--line)] bg-[var(--card)] p-6 shadow-[0_12px_30px_rgba(20,33,29,0.06)] sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--orange)]">Mon compte</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.05em]">Bienvenue, {account.member.pseudo}.</h1>
          <dl className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-[var(--paper-deep)] p-4"><dt className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">E-mail</dt><dd className="mt-2 break-all font-bold">{account.email ?? "E-mail masqué"}</dd></div>
            <div className="rounded-2xl bg-[var(--paper-deep)] p-4"><dt className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">Pseudo</dt><dd className="mt-2 font-bold">{account.member.pseudo}</dd></div>
          </dl>
          <p className="mt-6 text-[var(--muted)]">Ton compte est actif. Tu peux créer ou rejoindre une table depuis la page Jeux.</p>
        </section>
      </div>
    </main>
  );
}
