export function createTestClock(initialMs = Date.parse("2026-01-01T00:00:00.000Z")) {
  let currentMs = initialMs;
  return {
    now: () => currentMs,
    iso: () => new Date(currentMs).toISOString(),
    set: (nextMs: number) => { currentMs = nextMs; },
    advanceBy: (milliseconds: number) => { currentMs += milliseconds; },
  };
}
