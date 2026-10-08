"use client";

import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  GeoJSON,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { GeoCollection } from "@/lib/geojson";
import type { LatLng } from "@/lib/types";

export interface PopupRow {
  text: string;
  href?: string;
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  lines?: string[];
  rows?: PopupRow[]; // richer rows (optionally linked) — preferred over `lines`
  count?: number; // badge number (e.g. distinct players here); overrides row count
}

// Warm terracotta teardrop pin (avoids Leaflet's missing-image default icon).
function pinIcon(count?: number) {
  const badge =
    count && count > 1
      ? `<span style="position:absolute;top:-6px;right:-6px;background:#2f2823;color:#fff;border-radius:999px;font:700 10px/16px var(--font-inter,sans-serif);min-width:16px;height:16px;text-align:center;padding:0 3px;box-shadow:0 1px 3px rgba(0,0,0,.3)">${count}</span>`
      : "";
  return L.divIcon({
    className: "",
    html: `<div style="position:relative">
      <svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 13.2 23.4 13.8 24a1.7 1.7 0 0 0 2.4 0C16.8 38.4 30 25.5 30 15 30 6.7 23.3 0 15 0z" fill="#3c6e47"/>
        <circle cx="15" cy="15" r="6" fill="#f4f4e9"/>
      </svg>${badge}
    </div>`,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -36],
  });
}

function FitBounds({ markers, paths }: { markers: MapMarker[]; paths?: MapPath[] }) {
  const map = useMap();
  useEffect(() => {
    const pts: [number, number][] = [
      ...markers.map((m) => [m.lat, m.lng] as [number, number]),
      ...(paths ?? []).flatMap((p) => p.points.map((q) => [q.lat, q.lng] as [number, number])),
    ];
    if (!pts.length) return;
    if (pts.length === 1) {
      map.setView(pts[0], 9);
      return;
    }
    map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: paths?.length ? 15 : 11 });
  }, [map, markers, paths]);
  return null;
}

// Leaflet finishes a zoom animation with an uncancellable 250ms timeout. If the
// map unmounts first (switching screens mid-zoom) that callback reads the
// removed panes and throws "_leaflet_pos". It bails out when _animatingZoom is
// false, so clear that on unmount.
function StopAnimationsOnUnmount() {
  const map = useMap();
  useEffect(
    () => () => {
      // Not map.stop(): it calls setZoom, which itself throws once the map
      // container has been removed.
      (map as unknown as { _animatingZoom: boolean })._animatingZoom = false;
    },
    [map]
  );
  return null;
}

// Pans/zooms when `target` changes (e.g. a search result was picked).
function FlyTo({ target }: { target: LatLng & { zoom: number } }) {
  const map = useMap();
  useEffect(() => {
    map.setView([target.lat, target.lng], target.zoom);
  }, [map, target]);
  return null;
}

function ClickHandler({ onClick }: { onClick: (ll: LatLng) => void }) {
  useMapEvents({ click: (e) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

export interface MapPath {
  id: string;
  points: LatLng[];
  color?: string;
  title?: string; // popup label
}

const WORLD_BOUNDS: [[number, number], [number, number]] = [
  [-85, -180],
  [85, 180],
];

const HIGHLIGHT_STYLE = {
  fillColor: "#5bb8f5",
  fillOpacity: 0.35,
  color: "#2a81cb",
  weight: 1.2,
  opacity: 0.7,
};

export default function MapView({
  markers,
  overlays,
  showMarkers = true,
  className = "",
  paths,
  onMapClick,
  autoFit = true,
  initialCenter,
  focus,
}: {
  markers: MapMarker[];
  overlays?: GeoCollection[];
  showMarkers?: boolean;
  className?: string;
  paths?: MapPath[];
  onMapClick?: (ll: LatLng) => void;
  autoFit?: boolean; // editors turn this off so the view doesn't jump on every click
  initialCenter?: LatLng & { zoom: number };
  focus?: (LatLng & { zoom: number }) | null;
}) {
  const first = markers[0] ?? paths?.[0]?.points[0];
  const center: [number, number] = initialCenter
    ? [initialCenter.lat, initialCenter.lng]
    : first
      ? [first.lat, first.lng]
      : [30, 0];
  return (
    <MapContainer
      center={center}
      zoom={initialCenter ? initialCenter.zoom : first ? 5 : 2}
      scrollWheelZoom={true}
      // Keep the world in view: no dragging off its edges, no zooming out
      // past one copy, and no repeated copies to lose the pins in.
      maxBounds={WORLD_BOUNDS}
      maxBoundsViscosity={1}
      minZoom={2}
      worldCopyJump={false}
      className={`rounded-2xl border border-line overflow-hidden ${className}`}
      style={{ height: "100%", width: "100%" }}
    >
      {/* Esri World Topo: keyless, and draws trails and footpaths, which the
          route tracer needs. (CARTO basemaps now return "API KEY REQUIRED"
          tiles, and OSM's own servers block apps outside their usage policy.) */}
      <TileLayer
        attribution='Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, USGS, &copy; OpenStreetMap contributors'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
        maxZoom={19}
        noWrap
      />
      {overlays?.map((fc) => (
        <GeoJSON
          key={fc.features.map((f) => f.properties.name).join("|")}
          data={fc}
          style={HIGHLIGHT_STYLE}
          interactive={false}
        />
      ))}
      {showMarkers && markers.map((m, i) => (
        <Marker
          key={m.id}
          position={[m.lat, m.lng]}
          icon={pinIcon(m.count ?? (m.rows?.length || m.lines?.length) ?? undefined)}
          zIndexOffset={i}
        >
          <Popup>
            <strong style={{ fontFamily: "var(--font-fraunces, serif)", fontSize: "14px" }}>
              {m.title}
            </strong>
            {m.rows?.length ? (
              <ul style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: 12 }}>
                {m.rows.map((r, j) => (
                  <li key={j} style={{ marginBottom: 2 }}>
                    {r.href ? (
                      <a href={r.href} style={{ color: "#3c6e47", textDecoration: "underline" }}>
                        {r.text}
                      </a>
                    ) : (
                      r.text
                    )}
                  </li>
                ))}
              </ul>
            ) : m.lines?.length ? (
              <ul style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: 12 }}>
                {m.lines.map((l, j) => (
                  <li key={j}>{l}</li>
                ))}
              </ul>
            ) : null}
          </Popup>
        </Marker>
      ))}
      {paths?.map((p) => (
        <Polyline
          key={p.id}
          positions={p.points.map((q) => [q.lat, q.lng] as [number, number])}
          pathOptions={{ color: p.color ?? "#3c6e47", weight: 5, opacity: 0.85 }}
        >
          {p.title && <Popup>{p.title}</Popup>}
        </Polyline>
      ))}
      {onMapClick && <ClickHandler onClick={onMapClick} />}
      {focus && <FlyTo target={focus} />}
      <StopAnimationsOnUnmount />
      {autoFit && <FitBounds markers={markers} paths={paths} />}
    </MapContainer>
  );
}
