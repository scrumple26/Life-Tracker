"use client";

import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  lines?: string[];
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
        <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 13.2 23.4 13.8 24a1.7 1.7 0 0 0 2.4 0C16.8 38.4 30 25.5 30 15 30 6.7 23.3 0 15 0z" fill="#c2603d"/>
        <circle cx="15" cy="15" r="6" fill="#faf5ec"/>
      </svg>${badge}
    </div>`,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -36],
  });
}

function FitBounds({ markers }: { markers: MapMarker[] }) {
  const map = useMap();
  useEffect(() => {
    if (!markers.length) return;
    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 9);
      return;
    }
    const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
  }, [map, markers]);
  return null;
}

export default function MapView({
  markers,
  className = "",
}: {
  markers: MapMarker[];
  className?: string;
}) {
  const center: [number, number] = markers.length
    ? [markers[0].lat, markers[0].lng]
    : [30, 0];
  return (
    <MapContainer
      center={center}
      zoom={markers.length ? 5 : 2}
      scrollWheelZoom={false}
      className={`rounded-2xl border border-line overflow-hidden ${className}`}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      {markers.map((m, i) => (
        <Marker
          key={m.id}
          position={[m.lat, m.lng]}
          icon={pinIcon(m.lines?.length ? m.lines.length : undefined)}
          zIndexOffset={i}
        >
          <Popup>
            <strong style={{ fontFamily: "var(--font-fraunces, serif)", fontSize: "14px" }}>
              {m.title}
            </strong>
            {m.lines?.length ? (
              <ul style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: 12 }}>
                {m.lines.map((l, j) => (
                  <li key={j}>{l}</li>
                ))}
              </ul>
            ) : null}
          </Popup>
        </Marker>
      ))}
      <FitBounds markers={markers} />
    </MapContainer>
  );
}
