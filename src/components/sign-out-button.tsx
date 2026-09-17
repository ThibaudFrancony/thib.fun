"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase-browser";

export function SignOutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setBusy(true);
    try {
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return <button type="button" onClick={signOut} disabled={busy} className={className}>{busy ? "Déconnexion…" : "Se déconnecter"}</button>;
}
