import "server-only";

import type { NextResponse } from "next/server";
import { getAuthenticatedAccount, type AuthenticatedAccount } from "@/server/auth";
import { isAdminAccount } from "@/server/admin/repository";
import { jsonError } from "@/server/http";

export type AdminGuardResult =
  | { ok: true; account: AuthenticatedAccount }
  | { ok: false; response: NextResponse };

/**
 * Garde serveur de l'administration : session Auth valide puis vérification en
 * base que l'e-mail du compte appartient à `private.admin_accounts`. Un
 * utilisateur normal est refusé même s'il connaît les routes.
 */
export async function requireAdminAccount(): Promise<AdminGuardResult> {
  const account = await getAuthenticatedAccount();
  if (!account) return { ok: false, response: jsonError("UNAUTHORIZED", 401, "Connecte-toi pour accéder à cette page.") };
  if (!(await isAdminAccount(account.member.id))) {
    return { ok: false, response: jsonError("ADMIN_REQUIRED", 403, "Accès réservé à l'administration.") };
  }
  return { ok: true, account };
}
