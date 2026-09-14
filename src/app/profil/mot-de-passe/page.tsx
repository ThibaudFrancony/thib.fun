import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getAuthenticatedAccount } from "@/server/auth";
import { AccountSecurity } from "../account-security";

export const dynamic = "force-dynamic";

export default async function PasswordPage() {
  const account = await getAuthenticatedAccount();
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-5 pb-16 pt-8 sm:px-8">
        <Link href={account ? "/profil" : "/connexion"} className="text-sm font-bold text-[var(--muted)]">← {account ? "Mon profil" : "Connexion"}</Link>
        <p className="mt-8 text-sm font-bold uppercase tracking-[0.16em] text-[var(--orange)]">Sécurité du compte</p>
        <h1 className="mt-3 text-5xl font-black tracking-[-0.06em]">Accès et confirmation.</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--muted)]">Gère ton mot de passe ou demande à nouveau les messages de compte sans révéler si une adresse est inscrite.</p>
        <AccountSecurity email={account?.email ?? null} authenticated={Boolean(account)} isGuest={account?.isGuest ?? false} />
      </div>
    </main>
  );
}
