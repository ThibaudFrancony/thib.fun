import type { UnoCard, UnoColor, UnoSymbol } from "@/games/uno/types";

export const UNO_COLORS: readonly UnoColor[] = ["red", "yellow", "green", "blue"];

export function isNumberSymbol(symbol: UnoSymbol): boolean {
  return symbol >= "0" && symbol <= "9";
}

export function cardPoints(card: Pick<UnoCard, "symbol">): number {
  if (isNumberSymbol(card.symbol)) return Number(card.symbol);
  if (card.symbol === "wild" || card.symbol === "wild4") return 50;
  return 20;
}

export function buildUnoDeck(matchId: string): UnoCard[] {
  const cards: UnoCard[] = [];
  let instance = 0;
  const add = (color: UnoColor | null, symbol: UnoSymbol): void => {
    cards.push({ id: `${matchId}:uno:${String(instance).padStart(3, "0")}`, color, symbol });
    instance += 1;
  };

  for (const color of UNO_COLORS) {
    add(color, "0");
    for (const symbol of ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const) {
      add(color, symbol);
      add(color, symbol);
    }
    for (const symbol of ["skip", "reverse", "draw2"] as const) {
      add(color, symbol);
      add(color, symbol);
    }
  }
  for (let index = 0; index < 4; index += 1) {
    add(null, "wild");
    add(null, "wild4");
  }
  return cards;
}

export function isNumericCard(card: Pick<UnoCard, "symbol">): boolean {
  return isNumberSymbol(card.symbol);
}

export function cardLabel(card: Pick<UnoCard, "color" | "symbol">): string {
  if (card.symbol === "wild") return "Joker";
  if (card.symbol === "wild4") return "+4";
  if (card.symbol === "skip") return "Passe ton tour";
  if (card.symbol === "reverse") return "Sens inverse";
  if (card.symbol === "draw2") return "+2";
  return card.symbol;
}
