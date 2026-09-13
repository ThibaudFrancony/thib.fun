export type DeepSeekFixtureMode = "exact" | "false" | "slow" | "error";

type DeepSeekFixture = {
  fetchImpl: typeof fetch;
  readonly callCount: number;
  readonly requests: readonly string[];
};

/** Transport fixture used by unit tests; it never contacts the DeepSeek API. */
export function createDeepSeekFixture(modes: readonly DeepSeekFixtureMode[]): DeepSeekFixture {
  const queue = [...modes];
  const requests: string[] = [];
  let callCount = 0;
  const fetchImpl: typeof fetch = async (_input, init) => {
    callCount += 1;
    requests.push(typeof init?.body === "string" ? init.body : "");
    const mode = queue.shift() ?? "error";
    if (mode === "error") throw new Error("DEEPSEEK_FIXTURE_ERROR");
    if (mode === "slow") {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        const abort = () => reject(new DOMException("Aborted", "AbortError"));
        if (!signal) return;
        if (signal.aborted) abort();
        else signal.addEventListener("abort", abort, { once: true });
      });
    }
    const verdict = mode === "exact"
      ? { verdict: "accept", reasonCode: "exact_meaning" }
      : { verdict: "reject", reasonCode: "wrong_fact" };
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(verdict) } }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return {
    fetchImpl,
    get callCount() { return callCount; },
    requests,
  };
}
