import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';

// Brugerens GPS-position, delt på tværs af appen (kortets "min position",
// afstand til venner og startpunkt i rutefindingen).
//
// Hverken iOS eller Android viser den blå prik på kortet, før appen selv har
// bedt om lokationstilladelse - det gør vi her med expo-location.
//   permission: 'undetermined' | 'granted' | 'denied'
//   location:   { latitude, longitude } eller null, hvis vi ikke kender den
const LocationContext = createContext(null);

const LOCATE_TIMEOUT_MS = 10000;
// På Android er "Balanced" kun wifi og mobilmaster - det kan være flere
// hundrede meter forkert på et bjerg. Dér beder vi om GPS.
const ACCURACY = Platform.OS === 'android' ? Location.Accuracy.High : Location.Accuracy.Balanced;

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

  // Mens appen har lov, følger vi positionen (højst hver 20. meter), så rute
  // og afstande ikke regnes fra, hvor man stod, da appen blev åbnet.
  useEffect(() => {
    if (permission !== 'granted') return undefined;
    let subscription = null;
    let cancelled = false;
    Location.watchPositionAsync(
      { accuracy: ACCURACY, distanceInterval: 20, timeInterval: 10000 },
      (position) => setLocation(toPoint(position))
    )
      .then((sub) => {
        if (cancelled) sub.remove();
        else subscription = sub;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [permission]);

  // Beder om tilladelse (første gang viser systemet sin dialog) og henter en
  // frisk position. Returnerer { point, reason }:
  //   point:  positionen, eller null
  //   reason: null | 'denied' (ingen tilladelse) | 'unavailable' (ingen GPS-fix)
  // GPS'en får højst 10 sekunder; derefter bruges sidst kendte position.
  const locate = useCallback(async () => {
    let status;
    try {
      ({ status } = await Location.requestForegroundPermissionsAsync());
    } catch {
      return { point: null, reason: 'unavailable' };
    }
    if (status !== 'granted') {
      setPermission('denied');
      return { point: null, reason: 'denied' };
    }
    setPermission('granted');
    let position = null;
    try {
      position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: ACCURACY }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), LOCATE_TIMEOUT_MS)),
      ]);
    } catch {
      try {
        position = await Location.getLastKnownPositionAsync();
      } catch {
        position = null;
      }
    }
    const point = toPoint(position);
    if (!point) return { point: null, reason: 'unavailable' };
    setLocation(point);
    return { point, reason: null };
  }, []);

  // Kort form til de steder, der kun skal bruge positionen.
  const requestLocation = useCallback(async () => (await locate()).point, [locate]);

  const value = useMemo(
    () => ({ permission, location, requestLocation, locate }),
    [permission, location, requestLocation, locate]
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation skal bruges inden i LocationProvider');
  return ctx;
}
