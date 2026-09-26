import { describe, expect, it } from "vitest";
import { checkBombpartyWordLocally } from "@/games/bombparty/local-check";

describe("BombParty local lexical feedback", () => {
  const words = new Set(["chateau", "chat", "chariot"]);
  it("uses the engine's accent normalization and repetition rule", () => {
    expect(checkBombpartyWordLocally("CHÂTEAU", "cha", words, [])).toBe("valid");
    expect(checkBombpartyWordLocally("château", "cha", words, ["CHATEAU"])).toBe("used");
  });
  it("distinguishes invalid, unrelated and absent words", () => {
    expect(checkBombpartyWordLocally("chat-bot", "cha", words, [])).toBe("invalid");
    expect(checkBombpartyWordLocally("chat", "tri", words, [])).toBe("missing_sequence");
    expect(checkBombpartyWordLocally("chagrin", "cha", words, [])).toBe("unknown");
  });
});
