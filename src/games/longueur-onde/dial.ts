export type DialPoint = { x: number; y: number };

export function positionToDialPoint(valueInput: number, width: number, height: number, padding = 24): DialPoint {
  const value = Math.max(0, Math.min(100, valueInput));
  const cx = width / 2;
  const cy = height - padding;
  const radius = Math.max(0, Math.min(width / 2 - padding, height - padding - 8));
  const angle = Math.PI - (Math.PI * value) / 100;
  return { x: cx + radius * Math.cos(angle), y: cy - radius * Math.sin(angle) };
}

export function dialPositionFromPointer(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }, padding = 24): number {
  const cx = rect.width / 2;
  const cy = rect.height - padding;
  const dx = clientX - rect.left - cx;
  const dy = cy - (clientY - rect.top);
  const rawAngle = Math.atan2(dy, dx);
  const angle = Math.max(0, Math.min(Math.PI, rawAngle));
  return Math.max(0, Math.min(100, Math.round((1 - angle / Math.PI) * 100)));
}

export function dialArcPath(width: number, height: number, padding = 24): string {
  const cx = width / 2;
  const cy = height - padding;
  const radius = Math.max(0, Math.min(width / 2 - padding, height - padding - 8));
  return `M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`;
}
