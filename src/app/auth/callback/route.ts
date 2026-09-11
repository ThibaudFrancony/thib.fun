import { NextResponse } from "next/server";
import { createRequestSupabaseClient } from "@/server/supabase/server";

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/profil";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const supabase = await createRequestSupabaseClient();
  const code = url.searchParams.get("code");

  if (!supabase || !code) {
    return NextResponse.redirect(new URL(`/connexion?error=confirmation`, url.origin));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL(`/connexion?error=confirmation`, url.origin));
  return NextResponse.redirect(new URL(next, url.origin));
}
