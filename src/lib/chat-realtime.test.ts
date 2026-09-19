import { afterEach, describe, expect, it, vi } from "vitest";
import { subscribeChatRealtime } from "@/lib/chat-client";

type Client = Parameters<typeof subscribeChatRealtime>[0];
function setup() {
  const handlers = new Map<string, (message: { payload: unknown }) => void>();
  let status: (value: string) => void = () => undefined;
  const channel = {
    on: vi.fn((_kind, filter, handler) => { handlers.set(filter.event, handler); return channel; }),
    subscribe: vi.fn((handler) => { status = handler; return channel; }),
  };
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "alice" } }, error: null }) },
    realtime: { setAuth: vi.fn().mockResolvedValue(undefined) },
    channel: vi.fn(() => channel),
    removeChannel: vi.fn().mockResolvedValue("ok"),
  };
  return { client, handlers, channel, status: (value: string) => status(value) };
}

afterEach(() => vi.useRealTimers());

describe("abonnement privé du chat", () => {
  it("authentifie avant de souscrire et rattrape dès la première connexion", async () => {
    const fixture = setup();
    const onEvent = vi.fn();
    const stop = subscribeChatRealtime(fixture.client as unknown as Client, "alice", onEvent);
    await vi.waitFor(() => expect(fixture.channel.subscribe).toHaveBeenCalled());
    expect(fixture.client.realtime.setAuth.mock.invocationCallOrder[0]).toBeLessThan(fixture.client.channel.mock.invocationCallOrder[0]);
    expect(fixture.client.channel).toHaveBeenCalledWith("chat:alice", { config: { private: true } });
    fixture.status("SUBSCRIBED");
    expect(onEvent).toHaveBeenCalledWith({ type: "reconnected" });
    for (const id of ["general", "direct"]) fixture.handlers.get("chat.updated")?.({ payload: { id } });
    expect(onEvent).toHaveBeenCalledWith({ type: "chat", conversationId: "general" });
    expect(onEvent).toHaveBeenCalledWith({ type: "chat", conversationId: "direct" });
    stop();
    onEvent.mockClear();
    fixture.handlers.get("chat.updated")?.({ payload: { id: "general" } });
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("réessaie après un refus de canal puis relit à la reconnexion", async () => {
    vi.useFakeTimers();
    const fixture = setup();
    const onEvent = vi.fn();
    const stop = subscribeChatRealtime(fixture.client as unknown as Client, "alice", onEvent);
    await vi.advanceTimersByTimeAsync(0);
    fixture.status("CHANNEL_ERROR");
    await vi.advanceTimersByTimeAsync(3000);
    expect(fixture.client.channel).toHaveBeenCalledTimes(2);
    expect(fixture.client.removeChannel).toHaveBeenCalledTimes(1);
    fixture.status("SUBSCRIBED");
    expect(onEvent).toHaveBeenCalledWith({ type: "reconnected" });
    stop();
    await vi.advanceTimersByTimeAsync(6000);
    expect(fixture.client.channel).toHaveBeenCalledTimes(2);
  });

  it("réessaie une session indisponible sans souscrire sous une autre identité", async () => {
    vi.useFakeTimers();
    const fixture = setup();
    fixture.client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "bob" } }, error: null });
    const stop = subscribeChatRealtime(fixture.client as unknown as Client, "alice", vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    expect(fixture.client.channel).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3000);
    expect(fixture.client.channel).toHaveBeenCalledTimes(1);
    stop();
  });

  it("ne crée pas de canal si le composant est démonté pendant setAuth", async () => {
    const fixture = setup();
    let finish: () => void = () => undefined;
    fixture.client.realtime.setAuth.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    const stop = subscribeChatRealtime(fixture.client as unknown as Client, "alice", vi.fn());
    await vi.waitFor(() => expect(fixture.client.realtime.setAuth).toHaveBeenCalled());
    stop();
    finish();
    await Promise.resolve();
    expect(fixture.client.channel).not.toHaveBeenCalled();
  });
});
