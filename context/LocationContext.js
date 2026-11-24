import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as Location from 'expo-location';

// Brugerens GPS-position, delt på tværs af appen (kortets "min position",
// afstand til venner og startpunkt i rutefindingen).
//
// Hverken iOS eller Android viser den blå prik på kortet, før appen selv har
// bedt om lokationstilladelse - det gør vi her med expo-location.
//   permission: 'undetermined' | 'granted' | 'denied'
//   location:   { latitude, longitude } eller null, hvis vi ikke kender den
const LocationContext = createContext(null);

const toPoint = (position) =>
  position ? { latitude: position.coords.latitude, longitude: position.coords.longitude } : null;

export function LocationProvider({ children }) {
  const [permission, setPermission] = useState('undetermined');
  const [location, setLocation] = useState(null);

  // Ved opstart: spørg IKKE brugeren om noget endnu - tjek bare, om vi
  // allerede har lov fra en tidligere session, og brug i så fald sidst kendte
  // position.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (cancelled || status !== 'granted') return;
        setPermission('granted');
        const last = await Location.getLastKnownPositionAsync();
        if (!cancelled && last) setLocation(toPoint(last));
      } catch {
        // Ingen lokationstjeneste (fx web) - appen virker stadig uden.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Beder om tilladelse (første gang viser systemet sin dialog) og henter en
  // frisk position. Returnerer positionen eller null.
  const requestLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermission('denied');
        return null;
      }
      setPermission('granted');
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const point = toPoint(position);
      setLocation(point);
      return point;
    } catch {
      return null;
    }
  }, []);

  const value = useMemo(
    () => ({ permission, location, requestLocation }),
    [permission, location, requestLocation]
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation skal bruges inden i LocationProvider');
  return ctx;
}
