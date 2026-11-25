import AsyncStorage from '@react-native-async-storage/async-storage';

// HENTEDE SKIOMRÅDER PÅ TELEFONEN
//
// Et skiområde, der er hentet én gang (utils/resortData.js), gemmes her, så
// det virker uden net bagefter og ikke skal hentes igen.
//
// Koordinaterne fylder mest, så de pakkes fra
//   [{ latitude: 46.1, longitude: 7.2 }, ...]   til   [46.1, 7.2, ...]
// - det halverer størrelsen. Samme pakning bruges af de indbyggede
// skiområder i data/resorts/*.json.
//
// Hvert område ligger i fire dele (Android kan ikke læse en enkelt værdi på
// over ca. 2 MB), og kun de senest brugte områder beholdes.

const CURRENT_KEY = 'skimaps.resort.current';
const INDEX_KEY = 'skimaps.resort.index';
const PARTS = ['meta', 'lifts', 'pistes', 'places'];
const partKey = (id, part) => `skimaps.resort.${id}.${part}`;
// Android giver appen 6 MB i alt - fem områder holder sig godt under.
const MAX_SAVED = 5;

const packLine = ({ coordinates, ...line }) => ({
  ...line,
  c: coordinates.flatMap((p) => [p.latitude, p.longitude]),
});

const unpackLine = ({ c, ...line }) => {
  const coordinates = [];
  for (let i = 0; i + 1 < c.length; i += 2) coordinates.push({ latitude: c[i], longitude: c[i + 1] });
  return { ...line, coordinates };
};

// Ét skiområde -> { meta, lifts, pistes, places } klar til JSON.
export function packResort(resort) {
  const { lifts, pistes, places, ...meta } = resort;
  return { meta, lifts: lifts.map(packLine), pistes: pistes.map(packLine), places };
}

export function unpackResort(packed) {
  return {
    ...packed.meta,
    lifts: packed.lifts.map(unpackLine),
    pistes: packed.pistes.map(unpackLine),
    places: packed.places,
  };
}

const summaryOf = (resort) => ({
  id: resort.id,
  name: resort.name,
  country: resort.country,
  liftCount: resort.lifts.length,
  savedAt: Date.now(),
});

async function readJson(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// De hentede områder, senest brugte først: [{ id, name, country, liftCount }].
export async function listSavedResorts() {
  const index = await readJson(INDEX_KEY, []);
  return Array.isArray(index) ? index : [];
}

// `keepId` er det område, appen står i lige nu - det slettes aldrig.
export async function saveResort(resort, keepId = null) {
  const packed = packResort(resort);
  await AsyncStorage.multiSet(PARTS.map((part) => [partKey(resort.id, part), JSON.stringify(packed[part])]));
  const all = (await listSavedResorts()).filter((item) => item.id !== resort.id);
  all.unshift(summaryOf(resort));
  // Behold kun de senest brugte - resten slettes, så telefonen ikke fyldes.
  const index = all.filter((item, position) => position < MAX_SAVED || item.id === keepId);
  const dropped = all.filter((item) => !index.includes(item));
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
  for (const item of dropped) {
    await AsyncStorage.multiRemove(PARTS.map((part) => partKey(item.id, part))).catch(() => {});
  }
  return index;
}

// Returnerer området eller null, hvis det ikke (længere) ligger på telefonen.
export async function loadSavedResort(id) {
  try {
    const rows = await AsyncStorage.multiGet(PARTS.map((part) => partKey(id, part)));
    const packed = {};
    for (const [key, raw] of rows) {
      if (!raw) return null;
      packed[key.slice(key.lastIndexOf('.') + 1)] = JSON.parse(raw);
    }
    return unpackResort(packed);
  } catch {
    return null;
  }
}

// Flyt et område forrest i listen, når det bliver brugt - så er det de
// længst ubrugte, der ryger ud, når der skal gøres plads.
export async function touchSavedResort(id) {
  const all = await listSavedResorts();
  const used = all.find((item) => item.id === id);
  if (!used) return all;
  const index = [used, ...all.filter((item) => item.id !== id)];
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index)).catch(() => {});
  return index;
}

export async function removeSavedResort(id) {
  await AsyncStorage.multiRemove(PARTS.map((part) => partKey(id, part))).catch(() => {});
  const index = (await listSavedResorts()).filter((item) => item.id !== id);
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index)).catch(() => {});
  return index;
}

export const getCurrentResortId = () => AsyncStorage.getItem(CURRENT_KEY).catch(() => null);
export const setCurrentResortId = (id) => AsyncStorage.setItem(CURRENT_KEY, id).catch(() => {});
