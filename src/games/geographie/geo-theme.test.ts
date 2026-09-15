import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string) {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("direction artistique ExaPoint", () => {
  it("scopes the violet theme and its responsive states", () => {
    const css = read("src/app/globals.css");

    expect(css).toContain(".geo-page");
    expect(css).toContain("#452164");
    expect(css).toContain(".geo-map-shell");
    expect(css).toContain("@media (max-width: 899px)");
    expect(css).toContain("@media (max-width: 560px)");
    expect(css).toContain("@media (forced-colors: active)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("keeps the game wiring and accessible map controls intact", () => {
    const setup = read("src/games/geographie/components/geography-setup.tsx");
    const match = read("src/games/geographie/components/geography-match.tsx");
    const map = read("src/games/geographie/components/geography-map.tsx");

    for (const token of ["/api/rooms", "/api/rooms/join", "gameSlug", "rounds", "turnSeconds", "difficulty", "room-code"]) {
      expect(setup).toContain(token);
    }
    for (const token of ["/api/matches/", "PLACE_CITY", "SET_CITY_SELECTION", "CONFIRM_CITY_SELECTION", "RESIGN", "NEXT", "CLAIM_FORFEIT", "aria-live", "role=\"alert\""]) {
      expect(match).toContain(token);
    }
    for (const token of ["role=\"application\"", "tabIndex={0}", "data-map-ready", "aria-busy", "onKeyDown", "onPointerDown", "onWheel", "ResizeObserver", "Zoomer", "Recentrer"]) {
      expect(map).toContain(token);
    }
  });
});
