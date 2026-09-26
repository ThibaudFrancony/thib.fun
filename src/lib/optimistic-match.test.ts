import { describe, expect, it } from "vitest";
import { visibleOptimisticView } from "@/lib/optimistic-match";

describe("visual match prediction", () => {
  it("is scoped to one match, phase and canonical version", () => {
    const base = { matchId: "a", phaseId: "phase-1", version: 4, view: { phase: "playing" } };
    const pending = { matchId: "a", phaseId: "phase-1", version: 4, view: { phase: "waiting" } };
    expect(visibleOptimisticView(base, pending)).toBe(pending.view);
    expect(visibleOptimisticView({ ...base, version: 5 }, pending)).toBe(base.view);
    expect(visibleOptimisticView({ ...base, phaseId: "phase-2" }, pending)).toBe(base.view);
    expect(visibleOptimisticView({ ...base, matchId: "b" }, pending)).toBe(base.view);
  });
});
