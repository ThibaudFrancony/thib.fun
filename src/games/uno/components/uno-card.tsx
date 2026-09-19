"use client";

import type { UnoCard as UnoCardData, UnoColor } from "@/games/uno/types";
import { cardLabel } from "@/games/uno/deck";

export const UNO_CARD_BACK_SRC = "/uno/uno_dos.png";
export const UNO_WILD_SRC = "/uno/uno_changement_couleur.png";
export const UNO_WILD4_SRC = "/uno/uno_plus4.png";

const COLOR_ARTWORK: Record<UnoColor, string> = {
  red: "/uno/uno_rouge_vide.png",
  yellow: "/uno/uno_jaune_vide.png",
  green: "/uno/uno_vert_vide.png",
  blue: "/uno/uno_bleu_vide.png",
};

export type UnoCardArtwork = {
  /** Base affichée (carte vide colorée, joker, +4 ou dos). */
  src: string;
  /** Petit symbole répété dans les coins haut-gauche et bas-droite. */
  corner: string | null;
  /** Contenu posé au centre de la carte, sur l'ovale blanc. */
  center: { main: string; label?: string } | null;
};

/**
 * Choisit l'asset et le texte à superposer à partir de la carte du moteur.
 * Aucune image n'est dédiée à un numéro : la base colorée est complétée
 * dynamiquement par le chiffre ou le symbole.
 */
export function unoCardArtwork(card: Pick<UnoCardData, "color" | "symbol">): UnoCardArtwork {
  if (card.symbol === "wild") return { src: UNO_WILD_SRC, corner: null, center: null };
  if (card.symbol === "wild4") return { src: UNO_WILD4_SRC, corner: null, center: null };
  const src = card.color ? COLOR_ARTWORK[card.color] : UNO_CARD_BACK_SRC;
  if (card.symbol === "skip") return { src, corner: "∅", center: { main: "∅", label: "Passe ton tour" } };
  if (card.symbol === "reverse") return { src, corner: "⇄", center: { main: "⇄", label: "Sens inverse" } };
  if (card.symbol === "draw2") return { src, corner: "+2", center: { main: "+2" } };
  return { src, corner: card.symbol, center: { main: card.symbol } };
}

type UnoCardCommonProps = {
  playable?: boolean;
  disabled?: boolean;
  /** Animation de refus quand la carte n'est pas jouable au clic. */
  shake?: boolean;
  /** Met en avant la carte qui vient d'être piochée. */
  drawn?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

type UnoCardProps = UnoCardCommonProps & (
  | { faceDown: true; card?: null; label?: string; onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void }
  | { faceDown?: false; card: UnoCardData; label?: string; onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void }
);

function UnoCardVisual({ card, faceDown }: { card?: UnoCardData | null; faceDown?: boolean }) {
  const artwork = faceDown || !card
    ? { src: UNO_CARD_BACK_SRC, corner: null, center: null }
    : unoCardArtwork(card);
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- asset statique local, pas de dimension intrinsèque stable entre les bases */}
      <img className="uno-card-art" src={artwork.src} alt="" draggable={false} />
      {artwork.corner !== null && <span className="uno-card-corner uno-card-corner--top">{artwork.corner}</span>}
      {artwork.corner !== null && <span className="uno-card-corner uno-card-corner--bottom">{artwork.corner}</span>}
      {artwork.center && (
        <span className="uno-card-center">
          {artwork.center.label && <span className="uno-card-center-label">{artwork.center.label}</span>}
          <span className="uno-card-center-main">{artwork.center.main}</span>
        </span>
      )}
    </>
  );
}

export function UnoCard(props: UnoCardProps) {
  const { playable = false, disabled = false, shake = false, drawn = false, className = "", style, onClick, label } = props;
  const classes = [
    "uno-card",
    playable ? "uno-card--playable" : "",
    shake ? "uno-card--shake" : "",
    drawn ? "uno-card--drawn" : "",
    className,
  ].filter(Boolean).join(" ");
  const accessibleLabel = props.faceDown || !props.card
    ? label ?? "Carte face cachée"
    : label ?? `${cardLabel(props.card)}${playable ? " · jouable" : ""}`;

  if (onClick) {
    return (
      <button type="button" className={classes} style={style} aria-label={accessibleLabel} disabled={disabled} onClick={onClick}>
        <UnoCardVisual card={props.card} faceDown={props.faceDown} />
      </button>
    );
  }
  return (
    <span role="img" aria-label={accessibleLabel} className={classes} style={style}>
      <UnoCardVisual card={props.card} faceDown={props.faceDown} />
    </span>
  );
}
