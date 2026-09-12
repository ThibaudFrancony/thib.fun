import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

import { updateSupabaseSession } from "@/server/supabase/session-refresh";

const SUPABASE_URL = "https://session-refresh.test.supabase.co";
const SUPABASE_ANON_KEY = "session-refresh-anon-key";

describe("rafraîchissement de session Supabase SSR", () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
    mocks.createServerClient.mockImplementation(
      (_url: string, _key: string, options: {
        cookies: {
          getAll: () => { name: string; value: string }[];
          setAll: (values: { name: string; value: string; options: { path: string } }[]) => void;
        };
      }) => ({
        auth: {
          getUser: async () => {
            options.cookies.setAll([
              { name: "sb-refresh-token", value: "refreshed", options: { path: "/" } },
            ]);
            return await mocks.getUser();
          },
        },
      }),
    );
    mocks.getUser.mockResolvedValue({ data: { user: { id: "guest-1" } }, error: null });
  });

  afterEach(() => {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousAnonKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnonKey;
  });

  it("vérifie la session et recopie les cookies actualisés sur la réponse", async () => {
    const request = new NextRequest("http://localhost/", {
      headers: { cookie: "sb-old-token=stale" },
    });
    const response = await updateSupabaseSession(request);

    expect(mocks.createServerClient).toHaveBeenCalledOnce();
    expect(mocks.createServerClient.mock.calls[0][0]).toBe(SUPABASE_URL);
    expect(mocks.createServerClient.mock.calls[0][1]).toBe(SUPABASE_ANON_KEY);
    expect(mocks.getUser).toHaveBeenCalledOnce();
    // Les cookies lus côté requête proviennent bien de la requête entrante
    // (`setAll` y recopie aussi le jeton rafraîchi, comme dans le modèle
    // officiel Supabase).
    const handlers = mocks.createServerClient.mock.calls[0][2].cookies as {
      getAll: () => { name: string; value: string }[];
    };
    expect(handlers.getAll()).toContainEqual({ name: "sb-old-token", value: "stale" });
    // Le jeton rafraîchi est renvoyé au navigateur : la navigation suivante
    // arrive connectée côté SSR.
    expect(response.cookies.get("sb-refresh-token")?.value).toBe("refreshed");
  });

  it("laisse passer la requête sans client quand Supabase n'est pas configuré", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const response = await updateSupabaseSession(new NextRequest("http://localhost/"));

    expect(mocks.createServerClient).not.toHaveBeenCalled();
    expect(response.cookies.get("sb-refresh-token")).toBeUndefined();
  });
});
