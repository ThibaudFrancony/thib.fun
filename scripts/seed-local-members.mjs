import { execFileSync } from "node:child_process";

const supabaseEnv = { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" };

const LOCAL_USERS = [
  { email: process.env.E2E_ALICE_EMAIL ?? "alice@local.tibo.fun", pseudo: "Alice", avatarPreset: "avatar-1", status: "active" },
  { email: process.env.E2E_BOB_EMAIL ?? "bob@local.tibo.fun", pseudo: "Bob", avatarPreset: "avatar-2", status: "active" },
  { email: process.env.E2E_NON_MEMBER_EMAIL ?? "mallory@local.tibo.fun", pseudo: "Tiers", avatarPreset: "avatar-3", status: "disabled" },
];
const password = process.env.LOCAL_FIXTURE_PASSWORD;

if (!password || password.length < 8) {
  throw new Error("Définis LOCAL_FIXTURE_PASSWORD (8 caractères minimum) pour le fixture local.");
}

function readLocalEnv() {
  const output = execFileSync("supabase", ["status", "-o", "env"], { encoding: "utf8", env: supabaseEnv });
  return Object.fromEntries(
    output
      .split("\n")
      .filter((line) => line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1).trim().replace(/^"(.*)"$/, "$1")];
      }),
  );
}

const localEnv = readLocalEnv();
const apiUrl = process.env.API_URL ?? localEnv.API_URL;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY ?? localEnv.SERVICE_ROLE_KEY;

if (!apiUrl || !serviceRoleKey) throw new Error("Le statut Supabase local doit exposer API_URL et SERVICE_ROLE_KEY.");
const apiHost = new URL(apiUrl).hostname;
if (!new Set(["localhost", "127.0.0.1", "::1"]).has(apiHost)) throw new Error("Ce script accepte uniquement un Supabase local.");

const adminHeaders = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "content-type": "application/json",
};

async function adminRequest(path, init = {}) {
  const response = await fetch(`${apiUrl}${path}`, { ...init, headers: { ...adminHeaders, ...(init.headers ?? {}) } });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${path}: ${response.status} ${payload?.msg ?? payload?.message ?? "réponse invalide"}`);
  return payload;
}

const usersPage = await adminRequest("/auth/v1/admin/users?per_page=1000");
const existingUsers = new Map((usersPage.users ?? []).map((user) => [user.email, user]));
const users = [];
for (const fixture of LOCAL_USERS) {
  let user = existingUsers.get(fixture.email);
  if (!user) {
    user = await adminRequest("/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({ email: fixture.email, password, email_confirm: true }),
    });
  } else {
    user = await adminRequest(`/auth/v1/admin/users/${user.id}`, {
      method: "PUT",
      body: JSON.stringify({ password, email_confirm: true }),
    });
  }
  users.push({ ...fixture, id: user.id });
}

const sqlLiteral = (value) => `'${String(value).replaceAll("'", "''")}'`;
const profileValues = users
  .map((user) => `(${sqlLiteral(user.id)}, ${sqlLiteral(user.pseudo)}, ${sqlLiteral(user.pseudo.toLocaleLowerCase("fr-FR"))}, ${sqlLiteral(user.pseudo)}, ${sqlLiteral(user.avatarPreset)})`)
  .join(",\n  ");
const memberValues = users.map((user) => `(${sqlLiteral(user.id)}, 'member', ${sqlLiteral(user.status)})`).join(",\n  ");
const profilesSql = `insert into public.profiles (id, pseudo, pseudo_key, account_name, avatar_preset)
values
  ${profileValues}
on conflict (id) do update set
  pseudo = excluded.pseudo,
  pseudo_key = excluded.pseudo_key,
  account_name = excluded.account_name,
  avatar_preset = excluded.avatar_preset`;
const membersSql = `insert into private.site_members (user_id, role, status)
values
  ${memberValues}
on conflict (user_id) do update set role = excluded.role, status = excluded.status`;

execFileSync("supabase", ["db", "query", "--local", profilesSql], { stdio: "ignore", env: supabaseEnv });
execFileSync("supabase", ["db", "query", "--local", membersSql], { stdio: "ignore", env: supabaseEnv });

// Un salon d'accueil générique résiduel ferait basculer les pages de jeu en
// mode groupe et casserait les recettes « créer / rejoindre ». Le fixture le
// referme pour repartir d'un état propre.
const userIds = users.map((user) => sqlLiteral(user.id)).join(", ");
const closeLobbiesSql = `update private.rooms
set status = 'closed', current_match_id = null, version = version + 1
where status = 'waiting'
  and game_slug is null
  and exists (
    select 1 from private.room_members rm
    where rm.room_id = private.rooms.id and rm.user_id in (${userIds})
  )`;
execFileSync("supabase", ["db", "query", "--local", closeLobbiesSql], { stdio: "ignore", env: supabaseEnv });

console.log(users.map((user) => `${user.pseudo}: ${user.email} (${user.id})`).join("\n"));
