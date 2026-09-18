const DAY_FORMATTER = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
const DAY_YEAR_FORMATTER = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const SHORT_DAY_FORMATTER = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const TIME_FORMATTER = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function isSameDay(first: string | Date, second: string | Date): boolean {
  const a = typeof first === "string" ? new Date(first) : first;
  const b = typeof second === "string" ? new Date(second) : second;
  return startOfDay(a) === startOfDay(b);
}

function dayDifference(iso: string, now: Date): number {
  const date = new Date(iso);
  const diff = startOfDay(now) - startOfDay(date);
  return Math.round(diff / 86_400_000);
}

/** Heure seule pour aujourd'hui, date ajoutée dès que le message n'est plus du jour. */
export function formatMessageMeta(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const time = TIME_FORMATTER.format(date);
  const diff = dayDifference(iso, now);
  if (diff <= 0) return time;
  if (diff === 1) return `Hier ${time}`;
  if (date.getFullYear() === now.getFullYear()) return `${SHORT_DAY_FORMATTER.format(date)} ${time}`;
  return `${SHORT_DAY_FORMATTER.format(date)} ${date.getFullYear()} ${time}`;
}

export function formatDaySeparator(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const diff = dayDifference(iso, now);
  if (diff <= 0) return `Aujourd'hui · ${DAY_FORMATTER.format(date)}`;
  if (diff === 1) return `Hier · ${DAY_FORMATTER.format(date)}`;
  if (date.getFullYear() === now.getFullYear()) return DAY_FORMATTER.format(date);
  return DAY_YEAR_FORMATTER.format(date);
}

export function formatMessageTime(iso: string): string {
  return TIME_FORMATTER.format(new Date(iso));
}

export type ChatDayGroup<T> = { key: string; label: string; items: T[] };

export function groupMessagesByDay<T extends { createdAt: string }>(messages: readonly T[], now = new Date()): ChatDayGroup<T>[] {
  const groups: ChatDayGroup<T>[] = [];
  for (const message of messages) {
    const date = new Date(message.createdAt);
    const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(message);
    } else {
      groups.push({ key, label: formatDaySeparator(message.createdAt, now), items: [message] });
    }
  }
  return groups;
}

export function mergeMessages<T extends { id: string; seq: number }>(current: readonly T[], incoming: readonly T[]): T[] {
  const byId = new Map<string, T>();
  for (const message of current) byId.set(message.id, message);
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.seq - b.seq);
}

export type ChatPreviewText = { prefix: string; text: string; hasImage: boolean };

export function describePreview(
  preview: { authorId: string; body: string | null; imageUrl: string | null } | null,
  viewerId: string,
  counterpartId: string,
  counterpartName: string,
): ChatPreviewText | null {
  if (!preview) return null;
  const author = preview.authorId === viewerId ? "Toi" : counterpartId === preview.authorId ? counterpartName : null;
  const body = preview.body?.trim() ? preview.body.trim() : null;
  if (body) return { prefix: author ? `${author} · ` : "", text: body, hasImage: Boolean(preview.imageUrl) };
  if (preview.imageUrl) return { prefix: author ? `${author} · ` : "", text: "Photo", hasImage: true };
  return null;
}

export function formatMessageCount(count: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(count)} message${count > 1 ? "s" : ""}`;
}
