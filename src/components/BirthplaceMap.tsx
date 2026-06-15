"use client";

import { useMemo, useState } from "react";
import { MapPanel, type MapMarker } from "./Map";
import {
  featureForPoint,
  loadCountries,
  loadStates,
  normCountry,
  useGeo,
  type GeoCollection,
} from "@/lib/geojson";

export interface GeoPoint {
  lat: number;
  lng: number;
  country?: string;
  approx?: boolean; // country-level placement — counts for country, not state
}

export function BirthplaceMap({
  markers,
  points,
}: {
  markers: MapMarker[];
  points: GeoPoint[];
}) {
  const [showStates, setShowStates] = useState(false);
  const [showCountries, setShowCountries] = useState(false);
  const [showPins, setShowPins] = useState(true);
  const states = useGeo(loadStates, showStates);
  const countries = useGeo(loadCountries, showCountries);

  const stateInfo = useMemo(() => {
    if (!states) return null;
    const set = new Set<string>();
    for (const p of points) {
      if (p.approx) continue; // country-level coords can't identify a state
      const s = featureForPoint(p.lat, p.lng, states);
      if (s) set.add(s);
    }
    return { set, total: states.features.length };
  }, [states, points]);

  const countryInfo = useMemo(() => {
    if (!countries) return null;
    const known = new Map(
      countries.features.map((f) => [normCountry(f.properties.name), f.properties.name])
    );
    const set = new Set<string>(); // geojson names
    for (const p of points) {
      const gn = known.get(normCountry(p.country));
      if (gn) set.add(gn);
    }
    return { set, total: countries.features.length };
  }, [countries, points]);

  const overlays = useMemo(() => {
    const out: GeoCollection[] = [];
    if (showCountries && countries && countryInfo) {
      out.push({
        type: "FeatureCollection",
        features: countries.features.filter((f) => countryInfo.set.has(f.properties.name)),
      });
    }
    if (showStates && states && stateInfo) {
      out.push({
        type: "FeatureCollection",
        features: states.features.filter((f) => stateInfo.set.has(f.properties.name)),
      });
    }
    return out;
  }, [showStates, showCountries, states, countries, stateInfo, countryInfo]);

  return (
    <>
      <div className="flex gap-2 mb-3 flex-wrap">
        <Toggle
          on={showCountries}
          loading={showCountries && !countries}
          count={countryInfo ? `${countryInfo.set.size}/${countryInfo.total}` : null}
          onClick={() => setShowCountries((v) => !v)}
        >
          Countries
        </Toggle>
        <Toggle
          on={showStates}
          loading={showStates && !states}
          count={stateInfo ? `${stateInfo.set.size}/${stateInfo.total}` : null}
          onClick={() => setShowStates((v) => !v)}
        >
          US states
        </Toggle>
        <Toggle on={showPins} loading={false} count={null} onClick={() => setShowPins((v) => !v)}>
          {showPins ? "Pins on" : "Pins off"}
        </Toggle>
      </div>
      <div className="card p-3 sm:p-4">
        <MapPanel markers={markers} overlays={overlays} showMarkers={showPins} />
      </div>

      {showCountries && countryInfo && (
        <CollectedList
          title={`Countries collected (${countryInfo.set.size}/${countryInfo.total})`}
          names={[...countryInfo.set].sort()}
        />
      )}
      {showStates && stateInfo && (
        <CollectedList
          title={`US states collected (${stateInfo.set.size}/${stateInfo.total})`}
          names={[...stateInfo.set].sort()}
        />
      )}
    </>
  );
}

function CollectedList({ title, names }: { title: string; names: string[] }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-ink-soft mb-2">{title}</p>
      {names.length === 0 ? (
        <p className="text-xs text-muted">None yet — fetch birthplaces to fill these in.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {names.map((n) => (
            <span key={n} className="chip">
              {n}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Toggle({
  on,
  loading,
  count,
  onClick,
  children,
}: {
  on: boolean;
  loading: boolean;
  count: string | null;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition ${
        on
          ? "bg-terracotta text-white shadow-[0_6px_14px_rgba(60,110,71,0.28)]"
          : "bg-paper-2 text-ink-soft hover:text-ink"
      }`}
    >
      {children}
      {on && (loading ? " · …" : count ? ` · ${count}` : "")}
    </button>
  );
}
