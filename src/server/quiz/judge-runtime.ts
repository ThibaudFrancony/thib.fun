export type JudgeRuntime = {
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  setTimeoutImpl?: (handler: () => void, timeout?: number) => ReturnType<typeof setTimeout>;
  clearTimeoutImpl?: (handle: ReturnType<typeof setTimeout>) => void;
};

export type ResolvedJudgeRuntime = {
  fetchImpl: typeof fetch;
  now: () => number;
  sleep: (milliseconds: number) => Promise<void>;
  setTimeoutImpl: (handler: () => void, timeout?: number) => ReturnType<typeof setTimeout>;
  clearTimeoutImpl: (handle: ReturnType<typeof setTimeout>) => void;
};

export function resolveJudgeRuntime(runtime: JudgeRuntime = {}): ResolvedJudgeRuntime {
  return {
    fetchImpl: runtime.fetchImpl ?? ((...args) => fetch(...args)),
    now: runtime.now ?? (() => Date.now()),
    sleep: runtime.sleep ?? ((milliseconds) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds))),
    setTimeoutImpl: runtime.setTimeoutImpl ?? ((handler, timeout) => setTimeout(handler, timeout)),
    clearTimeoutImpl: runtime.clearTimeoutImpl ?? ((handle) => clearTimeout(handle)),
  };
}
