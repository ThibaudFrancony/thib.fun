"use client";

import { Avatar } from "@/components/avatar";

export function ChatAvatar({
  name,
  preset,
  imageUrl,
  size = 34,
  online,
}: {
  name: string;
  preset: string;
  imageUrl?: string | null;
  size?: number;
  online?: boolean;
}) {
  return (
    <span className="chat-avatar" style={{ width: size, height: size }}>
      <Avatar name={name} preset={preset} imageUrl={imageUrl} size={size} />
      {online === undefined ? null : <span className="chat-presence" data-online={online} aria-hidden="true" />}
    </span>
  );
}
