import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useResort } from './ResortContext';

// Rigtig gem/hent-funktionalitet: brugerens gemte steder gemmes lokalt på
// enheden med AsyncStorage, så de huskes selv efter appen lukkes og genåbnes.
// Det er IKKE hardcoded data - listen starter tom og fyldes udelukkende af
// brugerens egne tryk på hjerte-/gem-knappen.
//
// Hvert gemt sted husker, hvilket skiområde det hører til. Appen viser de
// gemte steder for det valgte område; `savedElsewhere` er antallet i andre.
const STORAGE_KEY = 'skimaps:savedPlaces';
// Steder gemt, før appen kunne skifte skiområde, er alle fra Verbier.
const LEGACY_RESORT_ID = 'verbier';

const SavedPlacesContext = createContext(null);

export function SavedPlacesProvider({ children }) {
  const { resort, model } = useResort();
  const [allSaved, setAllSaved] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Hent evt. tidligere gemte steder fra disk, når appen starter.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const parsed = raw ? JSON.parse(raw) : [];
        // Beskyt mod ødelagte data på disken: kun en liste af steder med id.
        if (Array.isArray(parsed)) setAllSaved(parsed.filter((p) => p && p.id));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Skriv til disk, hver gang listen ændrer sig (men ikke før første load,
  // så vi ikke overskriver gemte data med en tom liste ved opstart).
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(allSaved)).catch(() => {});
  }, [allSaved, loaded]);

  const resortId = resort.id;
  const here = useCallback((place) => (place.resortId || LEGACY_RESORT_ID) === resortId, [resortId]);

  // Vi gemmer hele stedet (så listen kan vises uden opslag), men hvis stedet
  // stadig findes i områdets data, bruger vi den nyeste udgave derfra. Ellers
  // ville en rettelse i data aldrig nå ud til allerede gemte steder.
  const savedPlaces = useMemo(
    () => allSaved.filter(here).map((saved) => model.findPlace(saved.id) || saved),
    [allSaved, here, model]
  );
  const savedElsewhere = allSaved.length - savedPlaces.length;

  const isSaved = useCallback((id) => allSaved.some((p) => p.id === id && here(p)), [allSaved, here]);

  const toggleSave = useCallback(
    (place) => {
      setAllSaved((prev) =>
        prev.some((p) => p.id === place.id && here(p))
          ? prev.filter((p) => !(p.id === place.id && here(p)))
          : [...prev, { ...place, resortId }]
      );
    },
    [here, resortId]
  );

  const removeSaved = useCallback(
    (id) => {
      setAllSaved((prev) => prev.filter((p) => !(p.id === id && here(p))));
    },
    [here]
  );

  const value = useMemo(
    () => ({ savedPlaces, savedElsewhere, isSaved, toggleSave, removeSaved }),
    [savedPlaces, savedElsewhere, isSaved, toggleSave, removeSaved]
  );

  return <SavedPlacesContext.Provider value={value}>{children}</SavedPlacesContext.Provider>;
}

export function useSavedPlaces() {
  const ctx = useContext(SavedPlacesContext);
  if (!ctx) throw new Error('useSavedPlaces skal bruges inden i SavedPlacesProvider');
  return ctx;
}
