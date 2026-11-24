import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { findPlace } from '../utils/places';

// Rigtig gem/hent-funktionalitet: brugerens gemte steder gemmes lokalt på
// enheden med AsyncStorage, så de huskes selv efter appen lukkes og genåbnes.
// Det er IKKE hardcoded data - listen starter tom og fyldes udelukkende af
// brugerens egne tryk på hjerte-/gem-knappen.
const STORAGE_KEY = 'skimaps:savedPlaces';

const SavedPlacesContext = createContext(null);

// Vi gemmer hele stedet (så listen kan vises uden opslag), men hvis stedet
// stadig findes i appens data, bruger vi den nyeste udgave derfra. Ellers
// ville en rettelse i data/*.js aldrig nå ud til allerede gemte steder.
const refresh = (saved) => findPlace(saved.id) || saved;

export function SavedPlacesProvider({ children }) {
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Hent evt. tidligere gemte steder fra disk, når appen starter.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const parsed = raw ? JSON.parse(raw) : [];
        // Beskyt mod ødelagte data på disken: kun en liste af steder med id.
        if (Array.isArray(parsed)) {
          setSavedPlaces(parsed.filter((p) => p && p.id).map(refresh));
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Skriv til disk, hver gang listen ændrer sig (men ikke før første load,
  // så vi ikke overskriver gemte data med en tom liste ved opstart).
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(savedPlaces)).catch(() => {});
  }, [savedPlaces, loaded]);

  const isSaved = useCallback((id) => savedPlaces.some((p) => p.id === id), [savedPlaces]);

  const toggleSave = useCallback((place) => {
    setSavedPlaces((prev) =>
      prev.some((p) => p.id === place.id)
        ? prev.filter((p) => p.id !== place.id)
        : [...prev, place]
    );
  }, []);

  const removeSaved = useCallback((id) => {
    setSavedPlaces((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const value = useMemo(
    () => ({ savedPlaces, isSaved, toggleSave, removeSaved }),
    [savedPlaces, isSaved, toggleSave, removeSaved]
  );

  return <SavedPlacesContext.Provider value={value}>{children}</SavedPlacesContext.Provider>;
}

export function useSavedPlaces() {
  const ctx = useContext(SavedPlacesContext);
  if (!ctx) throw new Error('useSavedPlaces skal bruges inden i SavedPlacesProvider');
  return ctx;
}
