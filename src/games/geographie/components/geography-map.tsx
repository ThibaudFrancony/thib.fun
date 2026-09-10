"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSON } from "geojson";
import { invertGeoPoint, pathForGeojson, projectGeoPoint, type FranceGeometry, type MapViewport } from "@/games/geographie/map-projection";
import type { GeoPoint } from "@/games/geographie/scoring";
import type { GeoView } from "@/games/geographie/types";

type GeographyMapProps = {
  view: GeoView;
  interactive: boolean;
  pendingPoint: GeoPoint | null;
  onPendingPointChange: (point: GeoPoint | null) => void;
};

const INITIAL_VIEWPORT: MapViewport = { scale: 1, offsetX: 0, offsetY: 0 };

export function GeographyMap({ view, interactive, pendingPoint, onPendingPointChange }: GeographyMapProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [map, setMap] = useState<FranceGeometry | null>(null);
  const [size, setSize] = useState({ width: 720, height: 500 });
  const [viewport, setViewport] = useState<MapViewport>(INITIAL_VIEWPORT);
  const [cursor, setCursor] = useState<[number, number] | null>(null);
  const dragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number; moved: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/maps/france-departments.geojson")
      .then((response) => response.json() as Promise<GeoJSON>)
      .then((value) => { if (active) setMap(value as FranceGeometry); })
      .catch(() => { if (active) setMap(null); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!shellRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const width = Math.max(300, Math.floor(entries[0]?.contentRect.width ?? 720));
      setSize({ width, height: Math.max(300, Math.min(560, Math.round(width * 0.68))) });
    });
    observer.observe(shellRef.current);
    return () => observer.disconnect();
  }, []);

  const path = useMemo(() => map ? pathForGeojson(map, size) : null, [map, size]);
  const pendingScreen = useMemo(() => map && pendingPoint ? projectGeoPoint(map, size, pendingPoint, viewport) : null, [map, pendingPoint, size, viewport]);
  const targetScreen = useMemo(() => map && view.targetPoint ? projectGeoPoint(map, size, view.targetPoint, viewport) : null, [map, size, view.targetPoint, viewport]);
  const placementScreens = useMemo(() => map ? view.players.map((player) => player.placement ? projectGeoPoint(map, size, { longitude: player.placement.longitude, latitude: player.placement.latitude }, viewport) : null) : [null, null], [map, size, view.players, viewport]);

  function pointFromEvent(event: { clientX: number; clientY: number }): [number, number] | null {
    const svg = svgRef.current;
    if (!svg || !map) return null;
    const rect = svg.getBoundingClientRect();
    return [((event.clientX - rect.left) / rect.width) * size.width, ((event.clientY - rect.top) / rect.height) * size.height];
  }

  function chooseScreenPoint(screenPoint: [number, number]) {
    if (!map || !interactive) return;
    const inverted = invertGeoPoint(map, size, screenPoint, viewport);
    if (!inverted) return;
    onPendingPointChange({ latitude: inverted.latitude, longitude: inverted.longitude });
    setCursor(screenPoint);
  }

  function onPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (!interactive) return;
    const point = pointFromEvent(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: point[0], y: point[1], offsetX: viewport.offsetX, offsetY: viewport.offsetY, moved: false };
  }

  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || !interactive) return;
    const point = pointFromEvent(event);
    if (!point) return;
    const dx = point[0] - drag.x;
    const dy = point[1] - drag.y;
    if (Math.hypot(dx, dy) > 8) drag.moved = true;
    if (drag.moved) setViewport((current) => ({ ...current, offsetX: drag.offsetX + dx, offsetY: drag.offsetY + dy }));
  }

  function onPointerUp(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const point = pointFromEvent(event);
    if (point && !drag.moved) chooseScreenPoint(point);
    dragRef.current = null;
  }

  function onWheel(event: React.WheelEvent<SVGSVGElement>) {
    if (!interactive) return;
    event.preventDefault();
    const amount = event.deltaY < 0 ? 0.15 : -0.15;
    setViewport((current) => ({ ...current, scale: Math.min(3, Math.max(1, current.scale + amount)) }));
  }

  function onKeyDown(event: React.KeyboardEvent<SVGSVGElement>) {
    if (!interactive) return;
    const step = event.shiftKey ? 20 : 5;
    let dx = 0;
    let dy = 0;
    if (event.key === "ArrowLeft") dx = -step;
    if (event.key === "ArrowRight") dx = step;
    if (event.key === "ArrowUp") dy = -step;
    if (event.key === "ArrowDown") dy = step;
    if (dx || dy) {
      event.preventDefault();
      const next: [number, number] = cursor ? [cursor[0] + dx, cursor[1] + dy] : [size.width / 2 + dx, size.height / 2 + dy];
      setCursor(next);
    } else if (event.key === "Enter") {
      event.preventDefault();
      chooseScreenPoint(cursor ?? [size.width / 2, size.height / 2]);
    }
  }

  const transform = `translate(${size.width / 2 + viewport.offsetX} ${size.height / 2 + viewport.offsetY}) scale(${viewport.scale}) translate(${-size.width / 2} ${-size.height / 2})`;
  return <div ref={shellRef} className="map-shell overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-[#dbe9e2] p-2">
    <div className="mb-2 flex items-center justify-between gap-2 px-2 text-xs font-bold text-[var(--muted)]"><span>Carte muette · métropole + Corse</span><span aria-live="polite">{pendingPoint ? "Point prêt à confirmer" : "Clique ou appuie sur Entrée"}</span></div>
    <svg ref={svgRef} role="application" aria-label="Carte muette de la France métropolitaine. Les flèches déplacent le curseur de cinq pixels, Maj de vingt pixels, et Entrée pose le point." tabIndex={0} viewBox={`0 0 ${size.width} ${size.height}`} className="h-auto w-full rounded-xl bg-[#e7f0ea]" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { dragRef.current = null; }} onWheel={onWheel} onKeyDown={onKeyDown}>
      <g transform={transform}>
        {path && <path d={path} fill="#c8ded1" stroke="#789a8b" strokeWidth={1.1 / viewport.scale} vectorEffect="non-scaling-stroke" />}
        {view.players.map((player, index) => { const point = placementScreens[index]; return point && (view.phase === "reveal" || view.phase === "finished") ? <g key={player.id} transform={`translate(${point[0]} ${point[1]})`}><circle r="9" fill={index === 0 ? "#d66d3c" : "#1f6657"} opacity="0.2" /><circle r="4.5" fill={index === 0 ? "#d66d3c" : "#1f6657"} stroke="white" strokeWidth="2" /><title>{player.pseudo}</title></g> : null; })}
        {targetScreen && <g transform={`translate(${targetScreen[0]} ${targetScreen[1]})`}><path d="M0 -12 L10 7 L0 3 L-10 7 Z" fill="#e9b949" stroke="#14211d" strokeWidth="2" /><title>Ville cible</title></g>}
        {pendingScreen && interactive && <g transform={`translate(${pendingScreen[0]} ${pendingScreen[1]})`}><circle r="10" fill="#ffffff" stroke="#14211d" strokeWidth="2" strokeDasharray="3 3" /><circle r="3" fill="#14211d" /></g>}
      </g>
    </svg>
    <div className="mt-2 flex flex-wrap gap-2 px-2 pb-1"><button type="button" aria-label="Zoomer" onClick={() => setViewport((current) => ({ ...current, scale: Math.min(3, current.scale + 0.25) }))} className="min-h-11 rounded-full border border-[var(--line)] bg-white px-4 text-sm font-black">+</button><button type="button" aria-label="Dézoomer" onClick={() => setViewport((current) => ({ ...current, scale: Math.max(1, current.scale - 0.25) }))} className="min-h-11 rounded-full border border-[var(--line)] bg-white px-4 text-sm font-black">−</button><button type="button" onClick={() => { setViewport(INITIAL_VIEWPORT); setCursor(null); }} className="min-h-11 rounded-full border border-[var(--line)] bg-white px-4 text-sm font-bold">Recentrer</button></div>
  </div>;
}
