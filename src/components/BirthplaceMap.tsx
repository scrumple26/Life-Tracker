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

// Countries in the world: the 193 UN members plus its two observer states
// (Vatican City, Palestine). The outline file only has 177 shapes, so it
// can't be the denominator.
const WORLD_COUNTRIES = 195;
const NOT_STATES = new Set(["District of Columbia", "Puerto Rico"]);

export interface GeoPoint {
  lat: number;
  lng: number;
  country?: string;
  approx?: boolean; // country-level placement — counts for country, not state
}

export function BirthplaceMap({
  markers,
  points,
  countries: countryList,
}: {
  markers: MapMarker[];
  points: GeoPoint[];
  // Every country to count, in any spelling (players without a pin too).
  // Defaults to the pins' countries. Pass the same list a "countries" view
  // shows so the two counts agree.
  countries?: string[];
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
    // The outlines include DC and Puerto Rico; they're shaded and listed but
    // don't count toward the 50.
    const counted = [...set].filter((s) => !NOT_STATES.has(s)).length;
    return { set, counted };
  }, [states, points]);

  const countryInfo = useMemo(() => {
    if (!countries) return null;
    const known = new Map(
      countries.features.map((f) => [normCountry(f.properties.name), f.properties.name])
    );
    // Collected = distinct countries (by normalized name), same as the list view.
    const collected = new Map<string, string>(); // norm key -> display name
    for (const raw of countryList ?? points.map((p) => p.country ?? "")) {
      const name = raw.trim();
      if (name && !collected.has(normCountry(name))) collected.set(normCountry(name), name);
    }
    // Shade each one's outline: by name, else by where its players' pins fall.
    // Countries too small for the outline set (Malta, Cape Verde…) can't be
    // shaded, but still count.
    const shaded = new Set<string>(); // geojson names
    const unshaded: string[] = [];
    for (const [key, name] of collected) {
      let gn = known.get(key);
      if (!gn) {
        const pin = points.find((p) => !p.approx && normCountry(p.country) === key);
        gn = (pin && featureForPoint(pin.lat, pin.lng, countries)) || undefined;
      }
      if (gn) shaded.add(gn);
      else unshaded.push(name);
    }
    return { names: [...collected.values()], shaded, unshaded: new Set(unshaded) };
  }, [countries, points, countryList]);

  const overlays = useMemo(() => {
    const out: GeoCollection[] = [];
    if (showCountries && countries && countryInfo) {
      out.push({
        type: "FeatureCollection",
        features: countries.features.filter((f) => countryInfo.shaded.has(f.properties.name)),
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
          count={countryInfo ? `${countryInfo.names.length}/${WORLD_COUNTRIES}` : null}
          onClick={() => setShowCountries((v) => !v)}
        >
          Countries
        </Toggle>
        <Toggle
          on={showStates}
          loading={showStates && !states}
          count={stateInfo ? `${stateInfo.counted}/50` : null}
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
          title={`Countries collected (${countryInfo.names.length} of ${WORLD_COUNTRIES})`}
          names={[...countryInfo.names].sort()}
          unshaded={countryInfo.unshaded}
        />
      )}
      {showStates && stateInfo && (
        <CollectedList
          title={`US states collected (${stateInfo.counted} of 50)`}
          names={[...stateInfo.set].sort()}
        />
      )}
    </>
  );
}

function CollectedList({
  title,
  names,
  unshaded,
}: {
  title: string;
  names: string[];
  unshaded?: Set<string>; // too small to have an outline on this map
}) {
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-ink-soft mb-2">{title}</p>
      {names.length === 0 ? (
        <p className="text-xs text-muted">None yet — fetch birthplaces to fill these in.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {names.map((n) => (
            <span key={n} className="chip" title={unshaded?.has(n) ? "Too small to shade on this map" : undefined}>
              {n}
              {unshaded?.has(n) ? "*" : ""}
            </span>
          ))}
        </div>
      )}
      {unshaded && unshaded.size > 0 && (
        <p className="text-xs text-muted mt-2">
          * Counted, but too small to shade on this map.
        </p>
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
