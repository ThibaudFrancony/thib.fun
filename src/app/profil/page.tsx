import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getAuthenticatedAccount } from "@/server/auth";
import { ProfileEditor } from "./profile-editor";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const account = await getAuthenticatedAccount();
  if (!account) {
    return <main className="min-h-screen"><SiteHeader /><div className="mx-auto max-w-xl px-5 py-16 text-center"><h1 className="text-4xl font-black">Ton compte</h1><p className="mt-4 text-[var(--muted)]">Connecte-toi pour retrouver ton espace personnel.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link href="/connexion" className="inline-flex rounded-full bg-[var(--green)] px-5 py-3 font-bold text-white">Se connecter</Link><Link href="/profil/mot-de-passe" className="inline-flex rounded-full border border-[var(--line)] bg-white px-5 py-3 font-bold">Mot de passe oublié ?</Link></div></div></main>;
  }

  if (account.isGuest) {
    return <main className="min-h-screen"><SiteHeader /><div className="mx-auto max-w-xl px-5 pb-16 pt-8 sm:px-8"><Link href="/" className="text-sm font-bold text-[var(--muted)]">← Jeux</Link><section className="mt-8 rounded-[1.5rem] border border-[var(--line)] bg-[var(--card)] p-6 shadow-[0_12px_30px_rgba(20,33,29,0.06)] sm:p-8"><p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--orange)]">Mode invité</p><h1 className="mt-3 text-4xl font-black tracking-[-0.05em]">Tu joues sous le pseudo {account.member.pseudo}.</h1><p className="mt-5 leading-7 text-[var(--muted)]">Cette session te permet de rejoindre des salons et de jouer, mais ton pseudo, tes résultats et ta progression ne sont pas conservés dans un compte.</p><div className="mt-7 flex flex-wrap gap-3"><Link href="/connexion?mode=signUp" className="inline-flex min-h-11 items-center rounded-full bg-[var(--green)] px-5 py-3 font-bold text-white">Créer un compte</Link><Link href="/" className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] px-5 py-3 font-bold">Retour aux jeux</Link></div></section></div></main>;
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
          <ProfileEditor pseudo={account.member.pseudo} avatarPreset={account.member.avatarPreset} avatarPath={account.member.avatarPath} />
          <div className="mt-7 flex flex-wrap gap-3 border-t border-[var(--line)] pt-6">
            <Link href="/profil/mot-de-passe" className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] bg-white px-5 py-3 font-bold">Sécurité et mot de passe</Link>
            <Link href="/historique" className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] bg-white px-5 py-3 font-bold">Voir mon historique</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
