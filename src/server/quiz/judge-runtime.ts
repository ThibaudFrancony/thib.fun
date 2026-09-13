export type JudgeRuntime = {
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  setTimeoutImpl?: (handler: () => void, timeout?: number) => ReturnType<typeof setTimeout>;
  clearTimeoutImpl?: (handle: ReturnType<typeof setTimeout>) => void;
  reserveAttempt?: () => Promise<AiAttemptReservation | null>;
  settleAttempt?: (settlement: AiAttemptSettlement) => Promise<void>;
};

export type AiAttemptReservation = {
  callNo: number;
};

export type AiAttemptSettlement = {
  callNo: number;
  status: "completed" | "failed" | "unknown";
  verdict?: "accept" | "reject" | "ambiguous";
  reasonCode?: string;
  inputTokens?: number;
  outputTokens?: number;
  actualCostUsd?: number;
};

export type ResolvedJudgeRuntime = {
  fetchImpl: typeof fetch;
  now: () => number;
  sleep: (milliseconds: number) => Promise<void>;
  setTimeoutImpl: (handler: () => void, timeout?: number) => ReturnType<typeof setTimeout>;
  clearTimeoutImpl: (handle: ReturnType<typeof setTimeout>) => void;
  reserveAttempt?: () => Promise<AiAttemptReservation | null>;
  settleAttempt?: (settlement: AiAttemptSettlement) => Promise<void>;
};

export function resolveJudgeRuntime(runtime: JudgeRuntime = {}): ResolvedJudgeRuntime {
  return {
    fetchImpl: runtime.fetchImpl ?? ((...args) => fetch(...args)),
    now: runtime.now ?? (() => Date.now()),
    sleep: runtime.sleep ?? ((milliseconds) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds))),
    setTimeoutImpl: runtime.setTimeoutImpl ?? ((handler, timeout) => setTimeout(handler, timeout)),
    clearTimeoutImpl: runtime.clearTimeoutImpl ?? ((handle) => clearTimeout(handle)),
    reserveAttempt: runtime.reserveAttempt,
    settleAttempt: runtime.settleAttempt,
  };
}
