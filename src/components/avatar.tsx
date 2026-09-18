import { AVATAR_PRESETS } from "@/app/profil/profile-helpers";

const PRESET_STYLES: Record<string, string> = {
  "orbit-1": "bg-[var(--green)] text-white",
  "orbit-2": "bg-[var(--orange)] text-white",
  "orbit-3": "bg-violet-600 text-white",
  "orbit-4": "bg-sky-600 text-white",
  "orbit-5": "bg-amber-400 text-[var(--ink)]",
  "orbit-6": "bg-rose-400 text-white",
  "orbit-7": "bg-cyan-600 text-white",
  "orbit-8": "bg-red-600 text-white",
};

function presetStyle(preset: string): string {
  if (Object.hasOwn(PRESET_STYLES, preset)) return PRESET_STYLES[preset];
  return PRESET_STYLES[AVATAR_PRESETS[0]];
}

function initialOf(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.slice(0, 1).toLocaleUpperCase("fr-FR") : "?";
}

/**
 * Rond d'avatar partagé (header, salons, parties, historique).
 * Affiche l'image privée quand `imageUrl` est fournie, sinon l'initiale du
 * nom effectif sur la couleur du preset. Jamais de chemin brut exposé.
 */
export function Avatar({
  name,
  preset,
  imageUrl,
  size = 40,
  emptyLabel = "Sans photo",
}: {
  name: string;
  preset: string;
  imageUrl?: string | null;
  size?: number;
  emptyLabel?: string;
}) {
  const style = { width: size, height: size, fontSize: Math.max(14, Math.round(size * 0.42)) };
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt={`Photo de ${name}`} width={size} height={size} style={style} className="shrink-0 rounded-full object-cover" />;
  }
  return (
    <span
      role="img"
      aria-label={name ? `Avatar de ${name}` : emptyLabel}
      style={style}
      className={`grid shrink-0 place-items-center rounded-full font-black ${presetStyle(preset)}`}
    >
      {initialOf(name)}
    </span>
  );
}
