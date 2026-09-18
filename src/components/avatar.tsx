import Image from "next/image";
import { avatarPresetImage } from "@/app/profil/profile-helpers";

function initialOf(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.slice(0, 1).toLocaleUpperCase("fr-FR") : "?";
}

/**
 * Rond d'avatar partagé (header, salons, parties, profil).
 * Priorité : photo privée (`imageUrl`) > PNG du preset > initiale.
 * Jamais de chemin brut exposé : `imageUrl` est une URL signée courte.
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
  const presetImage = avatarPresetImage(preset);
  if (presetImage) {
    return (
      <span style={style} className="relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#1d1040]">
        <Image src={presetImage} alt={`Avatar de ${name}`} width={size} height={size} style={{ width: "88%", height: "88%", objectFit: "contain" }} />
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label={name ? `Avatar de ${name}` : emptyLabel}
      style={style}
      className="grid shrink-0 place-items-center rounded-full bg-[#5a3fa8] font-black text-white"
    >
      {initialOf(name)}
    </span>
  );
}
