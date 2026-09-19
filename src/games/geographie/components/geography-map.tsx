"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSON } from "geojson";
import { invertGeoPoint, pathForGeojson, projectGeoPoint, type FranceGeometry, type MapSize, type MapViewport } from "@/games/geographie/map-projection";
import type { GeoPoint } from "@/games/geographie/scoring";
import type { GeoView } from "@/games/geographie/types";
import { Avatar } from "@/components/avatar";

type GeographyMapProps = {
  view: GeoView;
  interactive: boolean;
  pendingPoint: GeoPoint | null;
  onPendingPointChange: (point: GeoPoint | null) => void;
  avatars?: Record<string, string>;
};

const INITIAL_VIEWPORT: MapViewport = { scale: 1, offsetX: 0, offsetY: 0 };

export function clampMapPoint(point: [number, number], size: MapSize): [number, number] {
  return [
    Math.min(size.width, Math.max(0, point[0])),
    Math.min(size.height, Math.max(0, point[1])),
  ];
}

export function GeographyMapLoadError({ onRetry }: { onRetry: () => void }) {
  return <div role="alert" className="geo-map-error"><p>La carte n&apos;a pas pu être chargée.</p><button type="button" onClick={onRetry} className="geo-secondary-button">Réessayer</button></div>;
}

export function GeographyMap({ view, interactive, pendingPoint, onPendingPointChange, avatars = {} }: GeographyMapProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [map, setMap] = useState<FranceGeometry | null>(null);
  const [size, setSize] = useState({ width: 720, height: 500 });
  const [viewport, setViewport] = useState<MapViewport>(INITIAL_VIEWPORT);
  const [cursor, setCursor] = useState<[number, number] | null>(null);
  const [mapRequestKey, setMapRequestKey] = useState(0);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState(false);
  const dragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number; moved: boolean } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/maps/france-departments.geojson", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`MAP_${response.status}`);
        return response.json() as Promise<GeoJSON>;
      })
      .then((value) => setMap(value as FranceGeometry))
      .catch((reason: unknown) => {
        if (controller.signal.aborted || (reason instanceof DOMException && reason.name === "AbortError")) return;
        setMap(null);
        setMapError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setMapLoading(false);
      });
    return () => controller.abort();
  }, [mapRequestKey]);

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
  const keyboardCursor: [number, number] | null = interactive ? cursor ?? [size.width / 2, size.height / 2] : null;

  function pointFromEvent(event: { clientX: number; clientY: number }): [number, number] | null {
    const svg = svgRef.current;
    if (!svg || !map) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return clampMapPoint([
      ((event.clientX - rect.left) / rect.width) * size.width,
      ((event.clientY - rect.top) / rect.height) * size.height,
    ], size);
  }

  function chooseScreenPoint(screenPoint: [number, number]) {
    if (!map || !interactive) return;
    const clamped = clampMapPoint(screenPoint, size);
    const inverted = invertGeoPoint(map, size, clamped, viewport);
    if (!inverted) return;
    onPendingPointChange({ latitude: inverted.latitude, longitude: inverted.longitude });
    setCursor(clamped);
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
      const next: [number, number] = keyboardCursor ? [keyboardCursor[0] + dx, keyboardCursor[1] + dy] : [size.width / 2 + dx, size.height / 2 + dy];
      setCursor(clampMapPoint(next, size));
    } else if (event.key === "Enter") {
      event.preventDefault();
      chooseScreenPoint(keyboardCursor ?? [size.width / 2, size.height / 2]);
    }
  }

  const transform = `translate(${size.width / 2 + viewport.offsetX} ${size.height / 2 + viewport.offsetY}) scale(${viewport.scale}) translate(${-size.width / 2} ${-size.height / 2})`;
  return <div ref={shellRef} className="map-shell geo-map-shell">
    <div className="geo-map-toolbar"><span>Carte muette · métropole + Corse</span><span aria-live="polite">{pendingPoint ? "Point prêt à confirmer" : "Clique ou appuie sur Entrée"}</span></div>
    {mapLoading && !map && <p className="geo-map-loading" role="status">Chargement de la carte…</p>}
    {mapError && <GeographyMapLoadError onRetry={() => { setMapLoading(true); setMapError(false); setMapRequestKey((current) => current + 1); }} />}
    <svg ref={svgRef} role="application" aria-label="Carte muette de la France métropolitaine. Les flèches déplacent le curseur de cinq pixels, Maj de vingt pixels, et Entrée pose le point." aria-busy={mapLoading} data-map-ready={map ? "true" : "false"} tabIndex={0} viewBox={`0 0 ${size.width} ${size.height}`} className="geo-map-svg" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { dragRef.current = null; }} onWheel={onWheel} onKeyDown={onKeyDown}>
      <g transform={transform}>
        {path && <path d={path} fill="#684c8d" stroke="#d2b3f1" strokeWidth={1.1 / viewport.scale} vectorEffect="non-scaling-stroke" />}
      </g>
      {keyboardCursor && <g transform={`translate(${keyboardCursor[0]} ${keyboardCursor[1]})`} pointerEvents="none" aria-hidden="true"><circle r="14" fill="none" stroke="#fff" strokeWidth="3" opacity="0.9" /><circle r="14" fill="none" stroke="#25133d" strokeWidth="1.5" strokeDasharray="3 3" /><path d="M0 -20 V20 M-20 0 H20" stroke="#25133d" strokeWidth="1.5" /></g>}
      {view.players.map((player, index) => {
        const point = placementScreens[index];
        if (!point) return null;
        const showOwnPlacing = view.phase === "placing" && player.seat === view.mySeat;
        const showReveal = view.phase === "reveal" || view.phase === "finished";
        if (!showOwnPlacing && !showReveal) return null;
        return (
          <g key={player.id} transform={`translate(${point[0]} ${point[1]})`}>
            <title>{player.pseudo}</title>
            <circle r="6" fill="#25133d" stroke="#fff" strokeWidth="2" />
            <foreignObject x="-52" y="-64" width="104" height="54" style={{ overflow: "visible" }} pointerEvents="none">
              <div className="geo-guess-marker" data-self={player.seat === view.mySeat}>
                <span className="geo-guess-avatar">
                  <Avatar name={player.pseudo} preset={player.avatarPreset ?? "avatar-1"} imageUrl={avatars[player.id] ?? null} size={30} />
                </span>
                <span className="geo-guess-name">{player.pseudo}</span>
              </div>
            </foreignObject>
          </g>
        );
      })}
      {targetScreen && <g transform={`translate(${targetScreen[0]} ${targetScreen[1]})`}><path d="M0 -12 L10 7 L0 3 L-10 7 Z" fill="#ffe49a" stroke="#25133d" strokeWidth="2" /><title>Ville cible</title></g>}
      {pendingScreen && interactive && <g transform={`translate(${pendingScreen[0]} ${pendingScreen[1]})`}><circle r="11" fill="#fff" stroke="#25133d" strokeWidth="2" strokeDasharray="3 3" /><circle r="3" fill="#25133d" /></g>}
    </svg>
    <div className="geo-map-controls"><button type="button" aria-label="Zoomer" onClick={() => setViewport((current) => ({ ...current, scale: Math.min(3, current.scale + 0.25) }))} className="geo-map-button geo-map-zoom-button">+</button><button type="button" aria-label="Dézoomer" onClick={() => setViewport((current) => ({ ...current, scale: Math.max(1, current.scale - 0.25) }))} className="geo-map-button geo-map-zoom-button">−</button><button type="button" onClick={() => { setViewport(INITIAL_VIEWPORT); setCursor(null); }} className="geo-map-button">Recentrer</button></div>
  </div>;
}
