import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { lifts, pistes } from '../data/verbierMap';
import { elevations } from '../data/elevations';
import { buildGraph } from '../utils/routing';

// Den aktive rute, som RouteScreen har beregnet, og som MapScreen tegner.
// Ligger i en context, fordi ruten skal overleve skiftet fra rute-skærmen
// (i stack'en) til kort-fanen.
//   activeRoute: { destination, startLabel, steps, totalSeconds, totalMeters, coordinates } | null
const RouteContext = createContext(null);

// Grafen over lifter og pister bygges første gang, nogen beder om en rute
// (tager omkring 20 ms), og genbruges derefter.
let cachedGraph = null;
export function getSkiGraph() {
  if (!cachedGraph) cachedGraph = buildGraph({ lifts, pistes, elevations });
  return cachedGraph;
}

export function RouteProvider({ children }) {
  const [activeRoute, setActiveRoute] = useState(null);
  const clearRoute = useCallback(() => setActiveRoute(null), []);

  const value = useMemo(
    () => ({ activeRoute, setActiveRoute, clearRoute }),
    [activeRoute, clearRoute]
  );

  return <RouteContext.Provider value={value}>{children}</RouteContext.Provider>;
}

export function useRoute() {
  const ctx = useContext(RouteContext);
  if (!ctx) throw new Error('useRoute skal bruges inden i RouteProvider');
  return ctx;
}
