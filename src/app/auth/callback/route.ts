import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerConfig } from "@/server/config";

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u;
const SAFE_ROUTE_PREFIXES = ["/profil", "/salons", "/parties", "/jeux", "/historique", "/entrainement"];

function decodeNext(value: string): string | null {
  let decoded = value;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (CONTROL_CHARACTERS.test(decoded) || decoded.includes("\\")) return null;
    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      return null;
    }
    if (next === decoded) return decoded;
    decoded = next;
  }
  return null;
}

function isSafeRoute(pathname: string): boolean {
  return pathname === "/" || SAFE_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function safeNext(value: string | null, origin: string): string {
  if (!value || value.length > 2048 || CONTROL_CHARACTERS.test(value) || value.includes("\\")) return "/";
  const decoded = decodeNext(value);
  if (!decoded || !decoded.startsWith("/") || decoded.startsWith("//") || CONTROL_CHARACTERS.test(decoded) || decoded.includes("\\")) return "/";

  try {
    const resolved = new URL(decoded, origin);
    if (resolved.origin !== new URL(origin).origin || resolved.username || resolved.password || !isSafeRoute(resolved.pathname)) return "/";
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return "/";
  }
}

export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get("next"), request.nextUrl.origin);
  const config = getSupabaseServerConfig();
  const code = request.nextUrl.searchParams.get("code");

  if (!config || !code) {
    return redirectNoStore(request, "/connexion?error=confirmation");
  }

  // La réponse de redirection porte elle-même les cookies de session : un
  // client lié au magasin `cookies()` de la requête ne pourrait pas les y
  // écrire, et la navigation suivante arriverait déconnectée.
  const response = redirectNoStore(request, next);
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
  if (error) return redirectNoStore(request, "/connexion?error=confirmation");
  return response;
}

function redirectNoStore(request: NextRequest, destination: string): NextResponse {
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Vary", "Cookie");
  return response;
}
