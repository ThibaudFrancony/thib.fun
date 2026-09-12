import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rafraîchit la session Supabase sur chaque requête et propage les cookies
 * actualisés vers le navigateur. Sans ce passage, une connexion établie côté
 * client (dont `signInAnonymously`) reste invisible des Server Components :
 * `getUser()` y déclenche un rafraîchissement dont l'écriture est ignorée
 * (`setAll` sans effet dans un Server Component) et le navigateur ne reçoit
 * jamais les nouveaux cookies.
 */
export async function updateSupabaseSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Vérifie la session auprès du serveur Auth : c'est cet appel qui déclenche
  // le rafraîchissement du jeton et l'écriture des cookies via `setAll`.
  await supabase.auth.getUser();
  return response;
}
