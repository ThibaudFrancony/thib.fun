import { HomeHeroBackground } from "@/components/home-hero-background";
import { SiteHeaderCached } from "@/components/site-header-cached";
import { AuthForm } from "@/components/auth-form";

// Page statique : aucun appel serveur au rendu (`AuthForm` lit `?mode=` côté
// client, le compte est lu par l'îlot `SiteHeaderAuth`). Reprend le fond de
// l'accueil (`home-page` + `HomeHeroBackground`) avec un formulaire centré.
export const dynamic = "force-static";

export default function LoginPage() {
  return (
    <div className="home-page auth-page">
      <div className="home-hero">
        <HomeHeroBackground />
        <SiteHeaderCached variant="home" />
        <main className="auth-main">
          <AuthForm />
        </main>
      </div>
    </div>
  );
}
