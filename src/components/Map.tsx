"use client";

import dynamic from "next/dynamic";
import type { MapMarker } from "./MapView";

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
  className = "h-[420px]",
}: {
  markers: MapMarker[];
  className?: string;
}) {
  return (
    <div className={className}>
      <MapView markers={markers} />
    </div>
  );
}

export type { MapMarker };
