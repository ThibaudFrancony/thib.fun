import { describe, expect, it } from "vitest";
import { dialArcPath, dialPositionFromPointer, positionToDialPoint } from "@/games/longueur-onde/dial";

describe("cadran À l'unisson", () => {
  it("convertit les extrêmes sur un demi-cercle et reste stable après resize", () => {
    const left = positionToDialPoint(0, 320, 190);
    const right = positionToDialPoint(100, 320, 190);
    expect(left.x).toBeLessThan(right.x);
    expect(left.y).toBeCloseTo(right.y);
    expect(positionToDialPoint(-10, 320, 190)).toEqual(left);
    expect(positionToDialPoint(110, 320, 190)).toEqual(right);
    expect(positionToDialPoint(50, 390, 230).x).toBeCloseTo(195);
    expect(dialArcPath(320, 190)).toContain("A");
  });

  it("convertit un pointeur dans le cadran en valeur entière bornée", () => {
    const rect = { left: 10, top: 20, width: 320, height: 190 };
    const left = positionToDialPoint(0, rect.width, rect.height);
    const middle = positionToDialPoint(50, rect.width, rect.height);
    const right = positionToDialPoint(100, rect.width, rect.height);
    expect(dialPositionFromPointer(rect.left + left.x, rect.top + left.y, rect)).toBe(0);
    expect(dialPositionFromPointer(rect.left + middle.x, rect.top + middle.y, rect)).toBe(50);
    expect(dialPositionFromPointer(rect.left + right.x, rect.top + right.y, rect)).toBe(100);
    expect(dialPositionFromPointer(170, 250, rect)).toBe(100);
  });
});
