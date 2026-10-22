import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Rigtig gem/hent-funktionalitet: brugerens gemte steder gemmes lokalt på
// enheden med AsyncStorage, så de huskes selv efter appen lukkes og genåbnes.
// Det er IKKE hardcoded data - listen starter tom og fyldes udelukkende af
// brugerens egne tryk på hjerte-/gem-knappen.
const STORAGE_KEY = 'skimaps:savedPlaces';

const SavedPlacesContext = createContext(null);

export function SavedPlacesProvider({ children }) {
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Hent evt. tidligere gemte steder fra disk, når appen starter.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setSavedPlaces(JSON.parse(raw));
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

  const isSaved = (id) => savedPlaces.some((p) => p.id === id);

  const toggleSave = (place) => {
    setSavedPlaces((prev) =>
      prev.some((p) => p.id === place.id)
        ? prev.filter((p) => p.id !== place.id)
        : [...prev, place]
    );
  };

  const removeSaved = (id) => {
    setSavedPlaces((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <SavedPlacesContext.Provider value={{ savedPlaces, isSaved, toggleSave, removeSaved }}>
      {children}
    </SavedPlacesContext.Provider>
  );
}

export function useSavedPlaces() {
  const ctx = useContext(SavedPlacesContext);
  if (!ctx) throw new Error('useSavedPlaces skal bruges inden i SavedPlacesProvider');
  return ctx;
}
