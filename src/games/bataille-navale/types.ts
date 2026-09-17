import { z } from "zod";
import type { ResultSpec } from "@/games/contracts";

export const navalShipIdSchema = z.enum(["carrier", "battleship", "cruiser", "submarine", "destroyer"]);

export const navalOrientationSchema = z.enum(["horizontal", "vertical"]);

const coordinateSchema = z.number().int().min(0).max(9);

const navalCellSchema = z
  .object({
    row: coordinateSchema,
    col: coordinateSchema,
  })
  .strict();

export const navalShipSchema = z
  .object({
    id: navalShipIdSchema,
    row: coordinateSchema,
    col: coordinateSchema,
    orientation: navalOrientationSchema,
    length: z.number().int().min(2).max(5),
  })
  .strict();

export type NavalShip = z.infer<typeof navalShipSchema>;

export const navalShotSchema = z
  .object({
    row: coordinateSchema,
    col: coordinateSchema,
    result: z.enum(["miss", "hit", "sunk"]),
    shipId: navalShipIdSchema.optional(),
    shipType: navalShipIdSchema.optional(),
    sunkCells: z.array(navalCellSchema).max(5).optional(),
    automatic: z.boolean(),
  })
  .strict();

export type NavalShot = z.infer<typeof navalShotSchema>;

export const navalStateSchema = z.object({
  schemaVersion: z.literal(1),
  phase: z.enum(["setup", "playing", "finished"]),
  fleets: z.tuple([z.array(navalShipSchema).max(5), z.array(navalShipSchema).max(5)]),
  ready: z.tuple([z.boolean(), z.boolean()]),
  activeSeat: z.union([z.literal(0), z.literal(1)]),
  shots: z.tuple([z.array(navalShotSchema).max(100), z.array(navalShotSchema).max(100)]),
  turn: z.number().int().min(1),
  lastShot: z
    .object({
      by: z.union([z.literal(0), z.literal(1)]),
      shot: navalShotSchema,
    })
    .strict()
    .nullable(),
  finishedOutcome: z.enum(["win", "draw", "abandoned"]).nullable(),
  finishedReason: z.string().nullable(),
  winnerId: z.string().nullable(),
}).strict();

export type NavalState = z.infer<typeof navalStateSchema>;

const fleetEntrySchema = z
  .object({
    id: navalShipIdSchema,
    row: coordinateSchema,
    col: coordinateSchema,
    orientation: navalOrientationSchema,
  })
  .strict();

export const navalActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SET_FLEET"), ships: z.array(fleetEntrySchema).max(5) }).strict(),
  z.object({ type: z.literal("RANDOMIZE_FLEET") }).strict(),
  z.object({ type: z.literal("READY_FLEET") }).strict(),
  z.object({ type: z.literal("UNREADY_FLEET") }).strict(),
  z.object({ type: z.literal("FIRE"), row: coordinateSchema, col: coordinateSchema }).strict(),
  z.object({ type: z.literal("RESIGN") }).strict(),
]);

export type NavalAction = z.infer<typeof navalActionSchema>;

export type NavalShotView = {
  row: number;
  col: number;
  result: "miss" | "hit" | "sunk";
  shipId?: string;
  shipType?: string;
  sunkCells?: { row: number; col: number }[];
  automatic: boolean;
};

export type NavalShipView = {
  id: string;
  row: number;
  col: number;
  orientation: "horizontal" | "vertical";
  length: number;
};

export type NavalResultView = {
  outcome: ResultSpec["outcome"];
  winnerId: string | null;
  reason: string;
  players: [{ id: string; score: number | null }, { id: string; score: number | null }];
} | null;

export type NavalView = {
  kind: "bataille-navale";
  stateSchemaVersion: 1;
  phase: NavalState["phase"];
  turnSeconds: null | 60;
  mySeat: 0 | 1;
  activeSeat: 0 | 1;
  activePlayerId: string | null;
  turn: number;
  myFleet: NavalShipView[];
  myShots: NavalShotView[];
  incomingShots: NavalShotView[];
  myReady: boolean;
  opponentReady: boolean;
  sunkByMe: string[];
  sunkOfMine: string[];
  hitsByMe: number;
  missesByMe: number;
  opponentFleet: NavalShipView[] | null;
  lastShot: { by: 0 | 1; shot: NavalShotView } | null;
  players: [
    { id: string; seat: 0 | 1; pseudo: string; score: number; active: boolean },
    { id: string; seat: 0 | 1; pseudo: string; score: number; active: boolean },
  ];
  result: NavalResultView;
  allowedActions: string[];
};
