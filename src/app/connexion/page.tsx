import Link from "next/link";
import { SiteHeaderCached } from "@/components/site-header-cached";
import { AuthForm } from "@/components/auth-form";

// Page statique : aucun appel serveur au rendu (`AuthForm` lit `?mode=` côté
// client, le compte est lu par l'îlot `SiteHeaderAuth`).
export const dynamic = "force-static";

export default function LoginPage() {
  return (
    <main className="min-h-screen">
      <SiteHeaderCached />
      <div className="mx-auto grid max-w-5xl gap-10 px-5 pb-16 pt-10 md:grid-cols-[1fr_420px] md:items-center md:px-8">
        <section><p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--orange)]">La table est privée</p><h1 className="mt-3 text-5xl font-black leading-none tracking-[-0.05em]">Retrouve ton partenaire de jeu.</h1><p className="mt-6 max-w-lg text-lg leading-8 text-[var(--muted)]">Crée ton compte avec ton e-mail et ton mot de passe, puis retrouve ton espace personnel et tes parties.</p><Link href="/" className="mt-8 inline-block text-sm font-bold text-[var(--green)]">← Retour aux jeux</Link></section>
        <AuthForm />
      </div>
    </main>
  );
}
