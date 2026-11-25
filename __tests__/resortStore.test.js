import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  packResort,
  unpackResort,
  listSavedResorts,
  saveResort,
  loadSavedResort,
  touchSavedResort,
  removeSavedResort,
  getCurrentResortId,
  setCurrentResortId,
} from '../utils/resortStore';
import { miniResort } from './helpers/miniResort';

// Hentede skiområder på telefonen. AsyncStorage er her den officielle
// test-udgave, der gemmer i hukommelsen (se jest.setup.js).

const MAX_SAVED = 5; // samme tal som i utils/resortStore.js
const PARTS = ['meta', 'lifts', 'pistes', 'places'];
const keysFor = (id) => PARTS.map((part) => `skimaps.resort.${id}.${part}`);
const resort = (id, extra = {}) => miniResort({ id, name: `Resort ${id}`, country: 'Testland', ...extra });
const ids = (index) => index.map((item) => item.id);
const storedKeys = async () => [...(await AsyncStorage.getAllKeys())].sort();

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('packResort / unpackResort', () => {
  test('koordinater pakkes til en flad liste af tal', () => {
    const packed = packResort(resort('a'));
    expect(Object.keys(packed).sort()).toEqual(['lifts', 'meta', 'pistes', 'places']);
    expect(packed.lifts[0]).toEqual({ id: 'gondola', name: 'Village Gondola', liftType: 'gondola', c: [46.0, 7.0, 46.02, 7.0] });
    expect(packed.pistes[0].coordinates).toBeUndefined();
    // Alt andet end lifter, pister og steder ligger i "meta".
    expect(packed.meta).toMatchObject({ id: 'a', name: 'Resort a', timeZone: 'Europe/Zurich' });
    expect(packed.meta.lifts).toBeUndefined();
    expect(packed.meta.elevations).toEqual(resort('a').elevations);
    expect(packed.meta.toilets).toEqual(resort('a').toilets);
  });

  test('pak og pak ud igen giver præcis det samme skiområde', () => {
    const original = resort('a');
    expect(unpackResort(packResort(original))).toEqual(original);
  });

  test('overlever også turen gennem JSON (sådan gemmes det på telefonen)', () => {
    const original = resort('a');
    const stored = JSON.parse(JSON.stringify(packResort(original)));
    expect(unpackResort(stored)).toEqual(original);
  });

  test('pakningen fylder mindre end de upakkede koordinater', () => {
    const original = resort('a');
    const packedSize = JSON.stringify(packResort(original)).length;
    expect(packedSize).toBeLessThan(JSON.stringify(original).length);
  });

  test('de indbyggede områder i data/resorts/*.json bruger samme pakning', () => {
    const file = require('../data/resorts/hemsedal.json');
    const unpacked = unpackResort(file);
    expect(unpacked.lifts[0].coordinates[0]).toEqual({ latitude: file.lifts[0].c[0], longitude: file.lifts[0].c[1] });
    expect(unpacked.lifts[0].c).toBeUndefined();
    expect(packResort(unpacked)).toEqual(file);
  });

  test('originalen ændres ikke af at blive pakket', () => {
    const original = resort('a');
    const copy = JSON.parse(JSON.stringify(original));
    packResort(original);
    expect(original).toEqual(copy);
  });
});

describe('saveResort og loadSavedResort', () => {
  test('et område gemmes i fire dele og kan læses igen', async () => {
    const original = resort('a');
    const index = await saveResort(original);
    expect(await storedKeys()).toEqual([...keysFor('a'), 'skimaps.resort.index'].sort());
    expect(index).toEqual([expect.objectContaining({ id: 'a', name: 'Resort a', country: 'Testland', liftCount: 2 })]);
    expect(typeof index[0].savedAt).toBe('number');
    expect(await loadSavedResort('a')).toEqual(original);
  });

  test('listen er tom fra start', async () => {
    expect(await listSavedResorts()).toEqual([]);
    expect(await loadSavedResort('a')).toBeNull();
  });

  test('senest gemte står først', async () => {
    await saveResort(resort('a'));
    await saveResort(resort('b'));
    expect(ids(await saveResort(resort('c')))).toEqual(['c', 'b', 'a']);
    expect(ids(await listSavedResorts())).toEqual(['c', 'b', 'a']);
  });

  test('gemmes samme område igen, står det kun én gang - og forrest', async () => {
    await saveResort(resort('a'));
    await saveResort(resort('b'));
    const index = await saveResort(resort('a', { name: 'Resort a, hentet igen' }));
    expect(ids(index)).toEqual(['a', 'b']);
    expect(index[0].name).toBe('Resort a, hentet igen');
    expect((await loadSavedResort('a')).name).toBe('Resort a, hentet igen');
  });

  test(`kun de ${MAX_SAVED} senest brugte beholdes - det ældste slettes helt fra telefonen`, async () => {
    for (const id of ['a', 'b', 'c', 'd', 'e']) await saveResort(resort(id));
    const index = await saveResort(resort('f'));
    expect(ids(index)).toEqual(['f', 'e', 'd', 'c', 'b']);
    expect(index).toHaveLength(MAX_SAVED);
    expect(await loadSavedResort('a')).toBeNull();
    const keys = await storedKeys();
    for (const key of keysFor('a')) expect(keys).not.toContain(key);
    for (const key of keysFor('b')) expect(keys).toContain(key);
    expect(await loadSavedResort('b')).toEqual(resort('b'));
  });

  test('det område, appen står i (keepId), slettes aldrig - heller ikke når det er det ældste', async () => {
    await saveResort(resort('current'));
    let index;
    for (const id of ['b', 'c', 'd', 'e', 'f', 'g', 'h']) index = await saveResort(resort(id), 'current');
    expect(ids(index)).toEqual(['h', 'g', 'f', 'e', 'd', 'current']);
    expect(await loadSavedResort('current')).toEqual(resort('current'));
    // De andre gamle er røget ud som normalt.
    expect(await loadSavedResort('b')).toBeNull();
    expect(await loadSavedResort('c')).toBeNull();
  });

  test('uden keepId ryger det ældste ud, uanset hvad', async () => {
    await saveResort(resort('current'));
    let index;
    for (const id of ['b', 'c', 'd', 'e', 'f']) index = await saveResort(resort(id));
    expect(ids(index)).not.toContain('current');
    expect(await loadSavedResort('current')).toBeNull();
  });

  test('mangler en af de fire dele, er området væk (null) - ikke et halvt område', async () => {
    for (const part of PARTS) {
      await saveResort(resort('a'));
      await AsyncStorage.removeItem(`skimaps.resort.a.${part}`);
      expect(await loadSavedResort('a')).toBeNull();
    }
  });

  test('ødelagte data på telefonen giver null i stedet for en fejl', async () => {
    await saveResort(resort('a'));
    await AsyncStorage.setItem('skimaps.resort.a.pistes', '{ikke json');
    await expect(loadSavedResort('a')).resolves.toBeNull();
  });

  test('en ødelagt liste læses som tom', async () => {
    await AsyncStorage.setItem('skimaps.resort.index', '{ikke json');
    expect(await listSavedResorts()).toEqual([]);
    await AsyncStorage.setItem('skimaps.resort.index', JSON.stringify({ not: 'a list' }));
    expect(await listSavedResorts()).toEqual([]);
  });

  test('kan telefonen ikke læse, er området væk og listen tom', async () => {
    await saveResort(resort('a'));
    AsyncStorage.multiGet.mockRejectedValueOnce(new Error('disk error'));
    await expect(loadSavedResort('a')).resolves.toBeNull();
    AsyncStorage.getItem.mockRejectedValueOnce(new Error('disk error'));
    await expect(listSavedResorts()).resolves.toEqual([]);
  });

  test('er telefonen fuld, fejler saveResort - så ResortContext kan vise området alligevel', async () => {
    AsyncStorage.multiSet.mockRejectedValueOnce(new Error('disk full'));
    await expect(saveResort(resort('a'))).rejects.toThrow('disk full');
    expect(await listSavedResorts()).toEqual([]);
  });
});

describe('touchSavedResort', () => {
  test('flytter et brugt område forrest, så det er de længst ubrugte, der ryger ud', async () => {
    for (const id of ['a', 'b', 'c']) await saveResort(resort(id));
    expect(ids(await touchSavedResort('a'))).toEqual(['a', 'c', 'b']);
    expect(ids(await listSavedResorts())).toEqual(['a', 'c', 'b']);

    // "a" er nu senest brugt og overlever, når der skal gøres plads.
    for (const id of ['d', 'e', 'f']) await saveResort(resort(id));
    const index = await listSavedResorts();
    expect(ids(index)).toEqual(['f', 'e', 'd', 'a', 'c']);
    expect(await loadSavedResort('b')).toBeNull();
    expect(await loadSavedResort('a')).not.toBeNull();
  });

  test('et område, der ikke er gemt, ændrer ikke listen', async () => {
    for (const id of ['a', 'b']) await saveResort(resort(id));
    expect(ids(await touchSavedResort('missing'))).toEqual(['b', 'a']);
    expect(ids(await listSavedResorts())).toEqual(['b', 'a']);
  });

  test('det forreste område bliver stående forrest', async () => {
    for (const id of ['a', 'b']) await saveResort(resort(id));
    expect(ids(await touchSavedResort('b'))).toEqual(['b', 'a']);
  });
});

describe('removeSavedResort', () => {
  test('sletter alle fire dele og fjerner området fra listen', async () => {
    for (const id of ['a', 'b']) await saveResort(resort(id));
    expect(ids(await removeSavedResort('a'))).toEqual(['b']);
    expect(await loadSavedResort('a')).toBeNull();
    expect(await storedKeys()).toEqual([...keysFor('b'), 'skimaps.resort.index'].sort());
    expect(await loadSavedResort('b')).toEqual(resort('b'));
  });

  test('et område, der ikke findes, giver ingen fejl', async () => {
    await saveResort(resort('a'));
    expect(ids(await removeSavedResort('missing'))).toEqual(['a']);
  });

  test('rydder også op i listen, når dataene allerede er væk', async () => {
    // Sådan ser det ud, hvis telefonen har smidt dataene ud, men listen står tilbage.
    await saveResort(resort('a'));
    await AsyncStorage.multiRemove(keysFor('a'));
    expect(await loadSavedResort('a')).toBeNull();
    expect(await removeSavedResort('a')).toEqual([]);
  });
});

describe('det sidst valgte skiområde', () => {
  test('huskes mellem appstarter', async () => {
    expect(await getCurrentResortId()).toBeNull();
    await setCurrentResortId('verbier');
    expect(await getCurrentResortId()).toBe('verbier');
    await setCurrentResortId('b354be312d77204a1cb32a67e47e2334cb41ab5f');
    expect(await getCurrentResortId()).toBe('b354be312d77204a1cb32a67e47e2334cb41ab5f');
  });

  test('fejler telefonen, bliver appen bare i Verbier (null) uden at gå ned', async () => {
    AsyncStorage.getItem.mockRejectedValueOnce(new Error('disk error'));
    await expect(getCurrentResortId()).resolves.toBeNull();
    AsyncStorage.setItem.mockRejectedValueOnce(new Error('disk full'));
    await expect(setCurrentResortId('verbier')).resolves.toBeUndefined();
  });

  test('det valgte område ligger for sig selv og røres ikke af gem/slet', async () => {
    await setCurrentResortId('a');
    await saveResort(resort('a'));
    await removeSavedResort('a');
    expect(await getCurrentResortId()).toBe('a');
  });
});
