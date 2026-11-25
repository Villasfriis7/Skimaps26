import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lifts, pistes } from '../data/verbierMap';
import { elevations } from '../data/elevations';
import { buildGraph } from '../utils/routing';

// Den aktive rute, som RouteScreen har beregnet, og som MapScreen tegner.
// Ligger i en context, fordi ruten skal overleve skiftet fra rute-skærmen
// (i stack'en) til kort-fanen.
//   activeRoute: { destination, startLabel, start, skill, steps, totalSeconds,
//                  totalMeters, coordinates } | null
//   start: { choice: 'location' | 'lift', liftId } - så "Steps" på kortet kan
//          åbne præcis den rute, der er tegnet.
//
// Her ligger også brugerens niveau (den sværeste pist, de vil køre). Det
// huskes mellem ruter og gemmes på telefonen, så man ikke skal vælge "Blue"
// forfra hver gang.
const RouteContext = createContext(null);
const SKILL_KEY = 'skimaps.skill';
const SKILLS = ['none', 'easy', 'intermediate', 'advanced', 'freeride'];

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
  const [skill, setSkillState] = useState('intermediate');

  useEffect(() => {
    AsyncStorage.getItem(SKILL_KEY)
      .then((saved) => {
        if (SKILLS.includes(saved)) setSkillState(saved);
      })
      .catch(() => {});
  }, []);

  const setSkill = useCallback((next) => {
    setSkillState(next);
    AsyncStorage.setItem(SKILL_KEY, next).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ activeRoute, setActiveRoute, clearRoute, skill, setSkill }),
    [activeRoute, clearRoute, skill, setSkill]
  );

  return <RouteContext.Provider value={value}>{children}</RouteContext.Provider>;
}

export function useRoute() {
  const ctx = useContext(RouteContext);
  if (!ctx) throw new Error('useRoute skal bruges inden i RouteProvider');
  return ctx;
}
