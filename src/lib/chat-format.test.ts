import { describe, expect, it } from "vitest";
import {
  describePreview,
  formatDaySeparator,
  formatMessageCount,
  formatMessageMeta,
  groupMessagesByDay,
  isSameDay,
  mergeMessages,
} from "@/lib/chat-format";

const now = new Date(2026, 8, 18, 12, 0, 0);

function localIso(year: number, monthIndex: number, day: number, hours: number, minutes: number): string {
  return new Date(year, monthIndex, day, hours, minutes).toISOString();
}

describe("formatage du chat", () => {
  it("affiche l'heure seule pour aujourd'hui", () => {
    expect(formatMessageMeta(localIso(2026, 8, 18, 9, 5), now)).toBe("09:05");
  });

  it("préfixe Hier dès que le message date de la veille", () => {
    expect(formatMessageMeta(localIso(2026, 8, 17, 22, 14), now)).toBe("Hier 22:14");
  });

  it("affiche une date courte pour les messages plus anciens", () => {
    expect(formatMessageMeta(localIso(2026, 7, 27, 8, 3), now)).toMatch(/^27 .+08:03$/u);
    expect(formatMessageMeta(localIso(2025, 7, 27, 8, 3), now)).toMatch(/^27 .+2025 08:03$/u);
  });

  it("nomme les séparateurs de jour", () => {
    expect(formatDaySeparator(localIso(2026, 8, 18, 9, 5), now)).toBe("Aujourd'hui · 18 septembre");
    expect(formatDaySeparator(localIso(2026, 8, 17, 22, 14), now)).toBe("Hier · 17 septembre");
    expect(formatDaySeparator(localIso(2026, 7, 27, 8, 3), now)).toBe("27 août");
  });

  it("regroupe les messages par jour dans l'ordre", () => {
    const groups = groupMessagesByDay(
      [
        { id: "a", seq: 1, createdAt: localIso(2026, 8, 17, 22, 14) },
        { id: "b", seq: 2, createdAt: localIso(2026, 8, 18, 9, 5) },
        { id: "c", seq: 3, createdAt: localIso(2026, 8, 18, 9, 6) },
      ],
      now,
    );
    expect(groups).toHaveLength(2);
    expect(groups[0].items.map((item) => item.id)).toEqual(["a"]);
    expect(groups[1].items.map((item) => item.id)).toEqual(["b", "c"]);
  });

  it("fusionne sans doublon et trie par seq", () => {
    const merged = mergeMessages(
      [
        { id: "b", seq: 2 },
        { id: "a", seq: 1 },
      ],
      [
        { id: "b", seq: 2 },
        { id: "c", seq: 3 },
      ],
    );
    expect(merged.map((message) => message.id)).toEqual(["a", "b", "c"]);
  });

  it("décrit les aperçus de conversation", () => {
    expect(describePreview(null, "moi", "autre", "Léa")).toBeNull();
    expect(
      describePreview({ authorId: "autre", body: "Salut", imageUrl: null }, "moi", "autre", "Léa"),
    ).toEqual({ prefix: "Léa · ", text: "Salut", hasImage: false });
    expect(
      describePreview({ authorId: "moi", body: null, imageUrl: "https://x/y.webp" }, "moi", "autre", "Léa"),
    ).toEqual({ prefix: "Toi · ", text: "Photo", hasImage: true });
  });

  it("compte les messages au pluriel", () => {
    expect(formatMessageCount(0)).toBe("0 message");
    expect(formatMessageCount(2)).toBe("2 messages");
    expect(formatMessageCount(1842)).toMatch(/^1.?842 messages$/u);
  });

  it("compare deux dates au jour près", () => {
    expect(isSameDay(localIso(2026, 8, 18, 0, 1), localIso(2026, 8, 18, 23, 59))).toBe(true);
    expect(isSameDay(localIso(2026, 8, 18, 23, 59), localIso(2026, 8, 19, 0, 0))).toBe(false);
  });
});
