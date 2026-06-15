"use client";

import dynamic from "next/dynamic";
import type { MapMarker } from "./MapView";
import type { GeoCollection } from "@/lib/geojson";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full rounded-2xl border border-line bg-paper-2 flex items-center justify-center text-sm text-muted">
      Loading map…
    </div>
  ),
});

export function MapPanel({
  markers,
  overlays,
  showMarkers = true,
  className = "h-[420px]",
}: {
  markers: MapMarker[];
  overlays?: GeoCollection[];
  showMarkers?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <MapView markers={markers} overlays={overlays} showMarkers={showMarkers} />
    </div>
  );
}

export type { MapMarker };
