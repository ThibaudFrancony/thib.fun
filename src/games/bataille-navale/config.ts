import { z } from "zod";

export const navalTurnSecondsSchema = z.union([z.null(), z.literal(60)]);

export const navalConfigSchema = z
  .object({
    turnSeconds: navalTurnSecondsSchema.default(null),
  })
  .strict();

export type NavalConfig = z.infer<typeof navalConfigSchema>;

export const DEFAULT_NAVAL_CONFIG: NavalConfig = {
  turnSeconds: null,
};

export const NAVAL_SETUP_SECONDS = 180;
export const NAVAL_GRID_SIZE = 10;

export const NAVAL_SHIP_CATALOG = [
  { id: "carrier", length: 5 },
  { id: "battleship", length: 4 },
  { id: "cruiser", length: 3 },
  { id: "submarine", length: 3 },
  { id: "destroyer", length: 2 },
] as const;

export type NavalShipId = (typeof NAVAL_SHIP_CATALOG)[number]["id"];

export const NAVAL_SHIP_LENGTHS: Record<NavalShipId, number> = {
  carrier: 5,
  battleship: 4,
  cruiser: 3,
  submarine: 3,
  destroyer: 2,
};

export const NAVAL_TOTAL_CELLS = 17;
