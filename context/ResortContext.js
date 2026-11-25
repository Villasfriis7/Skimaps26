import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { verbier } from '../data/resorts/verbier';
import { bundledResorts, bundledResort } from '../data/resorts';
import { modelFor } from '../utils/resortModel';
import { downloadResort } from '../utils/resortData';
import {
  listSavedResorts,
  loadSavedResort,
  saveResort,
  touchSavedResort,
  removeSavedResort,
  getCurrentResortId,
  setCurrentResortId,
} from '../utils/resortStore';

// Det valgte skiområde, delt med hele appen.
//
//   resort          de rå data (lifter, pister, steder ...)
//   model           alt det afledte: opslag, nærmeste lift, rutegraf (utils/resortModel.js)
//   ready           false, indtil vi ved, hvilket område appen sidst stod i
//   bundledResorts  områder, der ligger klar i appen
//   savedResorts    områder, brugeren har hentet til telefonen
//   chooseResort()  skift område - henter det først, hvis det er nyt
//   job             det skift/den hentning, der er i gang:
//                   { item, text } mens det kører, { item, errorCode } ved fejl
//
// Appen starter i Verbier (indbygget) og husker derefter det sidst valgte.
//
// Selve skiftet ligger her og ikke i resort-vælgeren, fordi en hentning tager
// op til et minut: forlader brugeren vælgeren imens, hentes området færdigt og
// gemmes på telefonen - men appen skifter ikke område bag ryggen på dem.
const ResortContext = createContext(null);

export function ResortProvider({ children }) {
  const [resort, setResort] = useState(verbier);
  const [ready, setReady] = useState(false);
  const [savedResorts, setSavedResorts] = useState([]);
  const [job, setJob] = useState(null);
  const inFlight = useRef(false);
  const pickerOpen = useRef(false);
  const currentId = useRef(verbier.id);
  currentId.current = resort.id;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [id, saved] = await Promise.all([getCurrentResortId(), listSavedResorts()]);
        if (cancelled) return;
        setSavedResorts(saved);
        if (id && id !== verbier.id) {
          const bundled = bundledResort(id);
          const last = bundled ? bundled.load() : await loadSavedResort(id);
          if (last && !cancelled) setResort(last);
        }
      } catch {
        // Kan vi ikke læse fra telefonen, bliver vi bare i Verbier.
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // `item` er en række fra bundledResorts, savedResorts eller et søgeresultat
  // fra searchSkiAreas(). Fremdrift og fejl kan læses i `job`.
  const chooseResort = useCallback(async (item) => {
    if (inFlight.current) return; // kun ét skift ad gangen
    inFlight.current = true;
    setJob({ item, text: 'Opening...' });
    try {
      const bundled = bundledResort(item.id);
      let next = bundled ? bundled.load() : await loadSavedResort(item.id);
      if (next && !bundled) {
        setSavedResorts(await touchSavedResort(item.id));
      }
      if (!next) {
        if (!item.center) {
          // Området står i listen, men dets data er væk fra telefonen.
          setSavedResorts(await removeSavedResort(item.id));
          const error = new Error('Saved resort is missing');
          error.code = 'gone';
          throw error;
        }
        setJob({ item, text: 'Finding lifts and pistes...' });
        next = await downloadResort(item, (text) => setJob({ item, text }));
        setJob({ item, text: 'Saving to your phone...' });
        try {
          setSavedResorts(await saveResort(next, currentId.current));
        } catch {
          // Fuld telefon: området virker stadig nu, men skal hentes igen næste gang.
        }
      }
      setJob(null);
      // Skift kun, hvis brugeren stadig står i vælgeren og venter på det.
      if (pickerOpen.current) {
        await setCurrentResortId(next.id);
        setResort(next);
      }
    } catch (error) {
      setJob({ item, errorCode: error.code || 'network' });
    } finally {
      inFlight.current = false;
    }
  }, []);

  // Resort-vælgeren melder sig til og fra, så vi ved, om brugeren venter.
  const setPickerOpen = useCallback((open) => {
    pickerOpen.current = open;
  }, []);

  const dismissJob = useCallback(() => {
    setJob((current) => (current && current.errorCode ? null : current));
  }, []);

  const removeResort = useCallback(async (id) => {
    try {
      setSavedResorts(await removeSavedResort(id));
    } catch {
      // Kunne ikke slette - listen står, som den var.
    }
  }, []);

  const model = useMemo(() => modelFor(resort), [resort]);

  const value = useMemo(
    () => ({
      resort,
      model,
      ready,
      bundledResorts,
      savedResorts,
      job,
      chooseResort,
      dismissJob,
      setPickerOpen,
      removeResort,
    }),
    [resort, model, ready, savedResorts, job, chooseResort, dismissJob, setPickerOpen, removeResort]
  );

  return <ResortContext.Provider value={value}>{children}</ResortContext.Provider>;
}

export function useResort() {
  const ctx = useContext(ResortContext);
  if (!ctx) throw new Error('useResort skal bruges inden i ResortProvider');
  return ctx;
}
