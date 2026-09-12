import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerConfig } from "@/server/config";

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/profil";
}

export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const config = getSupabaseServerConfig();
  const code = request.nextUrl.searchParams.get("code");

  if (!config || !code) {
    return NextResponse.redirect(new URL(`/connexion?error=confirmation`, request.url));
  }

  // La réponse de redirection porte elle-même les cookies de session : un
  // client lié au magasin `cookies()` de la requête ne pourrait pas les y
  // écrire, et la navigation suivante arriverait déconnectée.
  const response = NextResponse.redirect(new URL(next, request.url));
  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL(`/connexion?error=confirmation`, request.url));
  return response;
}
