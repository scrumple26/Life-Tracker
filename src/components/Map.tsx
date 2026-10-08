"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { MapMarker, MapPath } from "./MapView";
import type MapViewType from "./MapView";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full rounded-2xl border border-line bg-paper-2 flex items-center justify-center text-sm text-muted">
      Loading map…
    </div>
  ),
});

export function MapPanel({
  className = "h-[420px]",
  ...props
}: ComponentProps<typeof MapViewType>) {
  return (
    <div className={className}>
      <MapView {...props} />
    </div>
  );
}

export type { MapMarker, MapPath };
