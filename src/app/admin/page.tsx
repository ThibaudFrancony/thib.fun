import { redirect } from "next/navigation";
import { AdminConsole } from "@/app/admin/admin-console";
import { PUBLIC_GAMES } from "@/games/registry";
import { isAdminAccount, listAdminConversations, listAdminGames } from "@/server/admin/repository";
import { getAuthenticatedAccount } from "@/server/auth";
import type { AdminConversationSummary, AdminGameEntry, AdminGameView } from "@/lib/admin-types";

export const dynamic = "force-dynamic";

function mergeGames(rows: AdminGameEntry[]): AdminGameView[] {
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  return PUBLIC_GAMES.map((game) => ({
    slug: game.slug,
    cardName: game.cardName,
    displayName: game.displayName,
    description: game.description,
    kind: game.kind,
    availability: bySlug.get(game.slug)?.availability ?? game.availability,
    visible: bySlug.get(game.slug)?.visible ?? true,
  }));
}

export default async function AdminPage() {
  const account = await getAuthenticatedAccount();
  if (!account) redirect("/");
  if (!(await isAdminAccount(account.member.id))) redirect("/");

  let games: AdminGameView[] = [];
  let conversations: AdminConversationSummary[] = [];
  let loadError = false;
  try {
    const [gameRows, conversationRows] = await Promise.all([
      listAdminGames(account.member.id),
      listAdminConversations(account.member.id),
    ]);
    games = mergeGames(gameRows);
    conversations = conversationRows;
  } catch {
    loadError = true;
  }

  return (
    <AdminConsole
      adminId={account.member.id}
      adminName={account.member.effectiveName}
      initialGames={games}
      initialConversations={conversations}
      loadError={loadError}
    />
  );
}
