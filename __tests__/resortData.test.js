import { searchSkiAreas, downloadResort, MAX_RESORT_RADIUS_M } from '../utils/resortData';
import { buildModel } from '../utils/resortModel';
import { findRoute } from '../utils/routing';
import { packResort, unpackResort } from '../utils/resortStore';
import { distanceMeters } from '../utils/geo';
import { installFetch, jsonResponse, hanging, deferred, calledUrls, settle } from './helpers/fetchMock';

// HENTNING AF SKIOMRÅDER - UDEN NET
//
// global.fetch er erstattet af vores egen funktion, og uret er jests falske:
// koden venter i virkeligheden op til flere minutter (timeouts, pauser mellem
// kald), men her skruer testen selv tiden frem, så det hele tager millisekunder.
//
// Svarene er håndlavede (se __tests__/fixtures/): et opdigtet skiområde,
// "Testdal", med lige præcis de særheder, koden skal kunne klare.

const searchFixture = require('./fixtures/openskimap-search.json');
const overpassFixture = require('./fixtures/overpass-testdal.json');

const KUMI = 'https://overpass.kumi.systems/api/interpreter';
const OVERPASS_DE = 'https://overpass-api.de/api/interpreter';
const MAIL_RU = 'https://maps.mail.ru/osm/tools/overpass/api/interpreter';

// Området, som searchSkiAreas() ville have givet for Testdal.
const testdal = {
  id: 'testdal-id',
  name: 'Testdal',
  country: 'Austria',
  convention: 'europe',
  center: { latitude: 47.005, longitude: 11.005 },
  radiusMeters: 1500,
};

// Testdals "terræn": 100 højdemeter pr. 0,001 breddegrad mod nord, 1000 m i landsbyen.
const heightAt = (latitude) => Math.round(1000 + (latitude - 47) * 100000);

// De punkter, et kald til højde-tjenesten spørger om.
const pointsIn = (url) => {
  const [, lats, lons] = url.match(/latitude=([^&]*)&longitude=([^&]*)/);
  const longitudes = lons.split(',').map(Number);
  return lats.split(',').map((lat, i) => ({ latitude: Number(lat), longitude: longitudes[i] }));
};
const elevationOk = (url) => jsonResponse({ elevation: pointsIn(url).map((p) => heightAt(p.latitude)) });
const forecastOk = () => jsonResponse({ timezone: 'Europe/Vienna', current: { temperature_2m: -3 } });
const overpassOk = () => jsonResponse(overpassFixture);
const noNet = () => {
  throw new TypeError('Network request failed');
};

// Sætter de tre tjenester op. Hver kan udskiftes i den enkelte test.
function servers({ overpass = overpassOk, elevation = elevationOk, forecast = forecastOk } = {}) {
  return installFetch((url, options) => {
    if (url.includes('/api/interpreter')) return overpass(url, options);
    if (url.startsWith('https://api.open-meteo.com/v1/elevation')) return elevation(url, options);
    if (url.startsWith('https://api.open-meteo.com/v1/forecast')) return forecast(url, options);
    throw new Error(`Uventet kald til ${url}`);
  });
}

const overpassCalls = (fetchMock) => calledUrls(fetchMock, '/api/interpreter');
const elevationCalls = (fetchMock) => calledUrls(fetchMock, '/v1/elevation');
const advance = (ms) => jest.advanceTimersByTimeAsync(ms);

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-01-05T12:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('searchSkiAreas', () => {
  const searchOk = () => installFetch(() => jsonResponse(searchFixture));

  test('søger hos OpenSkiMap med teksten kodet til en adresse', async () => {
    const fetchMock = searchOk();
    await searchSkiAreas('  Val d’Isère ');
    expect(calledUrls(fetchMock)).toEqual([
      `https://api.openskimap.org/search?query=${encodeURIComponent('Val d’Isère')}`,
    ]);
  });

  test('under to tegn søges der slet ikke', async () => {
    const fetchMock = searchOk();
    expect(await searchSkiAreas('')).toEqual([]);
    expect(await searchSkiAreas(' å ')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('et søgeresultat bliver til det, resort-vælgeren viser', async () => {
    searchOk();
    const areas = await searchSkiAreas('åre');
    expect(areas.find((area) => area.id === 'are')).toEqual({
      id: 'are',
      name: 'Åre',
      country: 'Sweden',
      region: 'Jämtland County',
      status: 'operating',
      convention: 'europe',
      center: { latitude: 63.4, longitude: 13.08 },
      // Halvdelen af diagonalen i en kasse på 6 x 8 km.
      radiusMeters: 5000,
      // Alle lifttyper lagt sammen, og kun alpine pister (ikke langrend).
      liftCount: 28,
      pisteKm: 71,
      hasDownhill: true,
    });
  });

  test('navne, der starter med det søgte, står først - derefter OpenSkiMaps rækkefølge', async () => {
    searchOk();
    const areas = await searchSkiAreas('åre');
    expect(areas.map((area) => area.name)).toEqual([
      'Arena Skidome', // starter med "are" (accenter er ligegyldige)
      'Åre', // starter også med "are", men kom senere i svaret
      'Bydalen - Åre Valley', // indeholder "are"
      'Storlien', // resten, i den rækkefølge de kom
      'Niseko United',
    ]);
  });

  test('alt, der ikke er et skiområde med lifter og alpine pister, sorteres fra', async () => {
    searchOk();
    const ids = (await searchSkiAreas('åre')).map((area) => area.id);
    expect(ids).not.toContain('are-gondola'); // en lift, ikke et skiområde
    expect(ids).not.toContain('old'); // nedlagt
    expect(ids).not.toContain('nordic'); // kun langrend
    expect(ids).not.toContain('no-lifts'); // ingen lifter
    expect(ids).not.toContain('nameless'); // uden navn
    expect(ids).not.toContain('no-center'); // uden midtpunkt
    expect(ids).toHaveLength(5);
  });

  test('japansk navn: det første navn med latinske bogstaver bruges', async () => {
    searchOk();
    const niseko = (await searchSkiAreas('niseko')).find((area) => area.id === 'niseko');
    expect(niseko).toMatchObject({ name: 'Niseko United', convention: 'japan', country: 'JP', liftCount: 28, pisteKm: 31 });
  });

  test('manglende oplysninger får standardværdier', async () => {
    searchOk();
    const areas = await searchSkiAreas('åre');
    const arena = areas.find((area) => area.id === 'arena');
    // Uden udstrækning gættes der på et mellemstort område, og midtpunktet er selve punktet.
    expect(arena).toMatchObject({ radiusMeters: 4000, center: { latitude: 46, longitude: 9 }, country: 'CH', region: '' });
    const storlien = areas.find((area) => area.id === 'storlien');
    expect(storlien).toMatchObject({ country: '', region: '', convention: 'europe', pisteKm: 0, liftCount: 5 });
    expect(areas.find((area) => area.id === 'bydalen').radiusMeters).toBe(2500);
  });

  test('et svar, der ikke er en liste, giver ingen resultater', async () => {
    installFetch(() => jsonResponse({ error: 'something' }));
    expect(await searchSkiAreas('verbier')).toEqual([]);
    installFetch(() => jsonResponse([]));
    expect(await searchSkiAreas('verbier')).toEqual([]);
  });

  test('fejl fra serveren kastes videre, så skærmen kan vise den', async () => {
    installFetch(() => jsonResponse({}, 503));
    await expect(searchSkiAreas('verbier')).rejects.toMatchObject({ message: 'HTTP 503', status: 503 });
    installFetch(noNet);
    await expect(searchSkiAreas('verbier')).rejects.toThrow('Network request failed');
  });

  test('svarer serveren ikke, opgives søgningen efter 12 sekunder', async () => {
    const fetchMock = installFetch((url, options) => hanging(options));
    const started = Date.now();
    const { error } = await settle(searchSkiAreas('verbier'));
    expect(error.name).toBe('AbortError');
    expect(Date.now() - started).toBe(12000);
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });
});

describe('downloadResort - når alt går godt', () => {
  let resort;
  let fetchMock;
  let progress;

  beforeEach(async () => {
    fetchMock = servers();
    progress = [];
    const outcome = await settle(downloadResort(testdal, (text) => progress.push(text)));
    expect(outcome.error).toBeUndefined();
    resort = outcome.value;
  });

  test('ét kald til Overpass, ét for tidszonen og ét for højderne', () => {
    expect(overpassCalls(fetchMock)).toEqual([KUMI]);
    expect(calledUrls(fetchMock, '/v1/forecast')).toEqual([
      'https://api.open-meteo.com/v1/forecast?latitude=47.005&longitude=11.005&current=temperature_2m&timezone=auto',
    ]);
    expect(elevationCalls(fetchMock)).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('Overpass spørges med appens navn og et kvadrat omkring området', () => {
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(KUMI);
    expect(options.method).toBe('POST');
    // Uden et rigtigt app-navn svarer Overpass med fejl 406.
    expect(options.headers).toMatchObject({
      'User-Agent': 'SkiMaps/1.0 (ski resort companion app)',
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    const query = decodeURIComponent(options.body.replace(/^data=/, ''));
    expect(query).toContain('[out:json]');
    expect(query).toContain('way["piste:type"~"^(downhill|sled|skitour)$"]');
    expect(query).toContain('["amenity"~"^(restaurant|cafe|bar|pub|toilets|ski_rental)$"]');
    const [south, west, north, east] = query.match(/\[bbox:([^\]]+)\]/)[1].split(',').map(Number);
    // Områdets radius (1500 m) plus 600 m luft.
    expect(distanceMeters({ latitude: south, longitude: 11.005 }, testdal.center)).toBeCloseTo(2100, -2);
    expect(distanceMeters({ latitude: north, longitude: 11.005 }, testdal.center)).toBeCloseTo(2100, -2);
    expect(distanceMeters({ latitude: 47.005, longitude: west }, testdal.center)).toBeCloseTo(2100, -2);
    expect(distanceMeters({ latitude: 47.005, longitude: east }, testdal.center)).toBeCloseTo(2100, -2);
  });

  test('brugeren får at vide, hvad der sker undervejs', () => {
    expect(progress).toEqual([
      'Finding lifts and pistes...',
      'Looking up elevations...',
      'Looking up elevations... 100%',
      'Sorting places...',
    ]);
  });

  test('grunddata kommer fra søgeresultatet', () => {
    expect(resort).toMatchObject({
      id: 'testdal-id',
      name: 'Testdal',
      country: 'Austria',
      convention: 'europe',
      bundled: false,
      timeZone: 'Europe/Vienna',
      pois: [],
      partners: [],
    });
    // Tidspunktet, hentningen blev færdig: 150 ms (pausen efter højde-kaldet) efter start.
    expect(resort.fetchedAt).toBe(new Date('2026-01-05T12:00:00.150Z').getTime());
    expect(Object.keys(resort).sort()).toEqual(
      [
        'id', 'name', 'country', 'convention', 'bundled', 'fetchedAt', 'region', 'weatherPoint',
        'weatherElevation', 'timeZone', 'towns', 'lifts', 'pistes', 'elevations', 'places', 'pois',
        'toilets', 'partners',
      ].sort()
    );
  });

  test('lifter: navn, type og forenklet linje', () => {
    expect(resort.lifts).toEqual([
      {
        id: 'w101',
        name: 'Dorfbahn',
        liftType: 'gondola',
        // Koordinaterne er afrundet til 5 decimaler, og punktet midt på den
        // rette linje er fjernet.
        coordinates: [
          { latitude: 47, longitude: 11 },
          { latitude: 47.01, longitude: 11 },
        ],
      },
      {
        id: 'w102',
        name: 'T2', // intet navn i OSM - så bruges nummeret
        liftType: 'drag_lift', // t-bar og j-bar er træklifter
        coordinates: [
          { latitude: 47.01, longitude: 11.01 },
          { latitude: 47.004, longitude: 11.01 },
        ],
      },
    ]);
    // Den private lift er ikke med.
    expect(resort.lifts.map((lift) => lift.name)).not.toContain('Privatlift');
  });

  test('pister: type, sværhedsgrad og navn', () => {
    expect(resort.pistes.map(({ coordinates, ...piste }) => ({ ...piste, points: coordinates.length }))).toEqual([
      { id: 'w201', name: 'Talabfahrt', type: 'downhill', difficulty: 'easy', points: 3 },
      // Uden sværhedsgrad og navn: "unknown" og "Piste <nummer>".
      { id: 'w202', name: 'Piste 7', type: 'downhill', difficulty: 'unknown', points: 3 },
      { id: 'w206', name: 'Rodelbahn', type: 'sled', difficulty: 'novice', points: 3 },
      // Japansk navn: det engelske bruges, når der er et.
      { id: 'w207', name: 'Family Run', type: 'downhill', difficulty: 'intermediate', points: 3 },
      { id: 'w208', name: 'Aufstieg Hochjoch', type: 'skitour', difficulty: 'unknown', points: 2 },
    ]);
  });

  test('pister, vi ikke kan bruge, springes over', () => {
    const names = resort.pistes.map((piste) => piste.name);
    expect(names).not.toContain('Übungswiese'); // tegnet som en lukket flade
    expect(names).not.toContain('Funpark'); // area=yes
    expect(names).not.toContain('Stummel'); // under 30 m
    expect(names).not.toContain('Ein Punkt'); // kun ét punkt
    expect(names).not.toContain('Gesperrt'); // access=no
  });

  test('højder for start og slut af hver lift og pist', () => {
    expect(resort.elevations).toEqual({
      w101: [1000, 2000],
      w102: [2000, 1400], // tegnet fra top til bund
      w201: [2000, 1000],
      w202: [2000, 1400],
      w206: [1800, 1200],
      w207: [2000, 1400],
      w208: [6000, 7000],
    });
  });

  test('ender, der deler punkt, slås op én gang - lifterne først', () => {
    const asked = pointsIn(elevationCalls(fetchMock)[0]);
    expect(asked).toHaveLength(9); // 7 linjer har 14 ender, men kun 9 forskellige
    expect(asked.slice(0, 4)).toEqual([
      { latitude: 47, longitude: 11 },
      { latitude: 47.01, longitude: 11 },
      { latitude: 47.01, longitude: 11.01 },
      { latitude: 47.004, longitude: 11.01 },
    ]);
  });

  test('steder: kategori, kontaktoplysninger og adresse - sorteret efter navn', () => {
    expect(resort.places).toEqual([
      {
        id: 'n301',
        name: 'Gasthof Post',
        category: 'restaurant',
        latitude: 47.0003,
        longitude: 11.0004,
        phone: '+43 5256 1234',
        website: 'www.gasthof-post.example',
        openingHours: 'Mo-Su 11:00-22:00',
        cuisine: 'regional;pizza',
        address: 'Dorfstraße 12',
      },
      {
        id: 'r308', // en relation: "r" + nummer
        name: 'Gipfelhütte',
        category: 'restaurant', // en bjerghytte er et spisested
        latitude: 47.0102,
        longitude: 11.0098,
        phone: null,
        website: null,
        openingHours: null,
        cuisine: null,
        address: null,
      },
      {
        id: 'w302', // en bygning: midtpunktet bruges
        name: 'Hotel Alpenblick',
        category: 'hotel',
        latitude: 47.0006,
        longitude: 11.0002,
        phone: '+43 5256 5678', // contact:phone
        website: 'https://alpenblick.example', // contact:website
        openingHours: null,
        cuisine: null,
        address: null,
      },
      expect.objectContaining({ id: 'n306', name: 'Kuhstall', category: 'apres_ski' }),
      expect.objectContaining({ id: 'n310', name: 'Mountain House', category: 'hotel' }),
      expect.objectContaining({ id: 'n307', name: 'Sport Huber', category: 'ski_rental', address: 'Liftweg' }),
    ]);
  });

  test('steder, der ikke hører til, er ikke med', () => {
    const ids = resort.places.map((place) => place.id);
    expect(ids).not.toContain('n303'); // samme hotel som w302, bare som punkt
    expect(ids).not.toContain('n304'); // over 1 km fra lifter og pister
    expect(ids).not.toContain('n305'); // uden navn
    expect(ids).not.toContain('w309'); // en bygning uden midtpunkt
    expect(ids).not.toContain('n311'); // et apotek er ikke en kategori i appen
  });

  test('toiletter: kun offentlige og kun i området', () => {
    expect(resort.toilets).toEqual([
      { id: 'n401', latitude: 47.0001, longitude: 11.0001 },
      { id: 'n404', latitude: 47.01, longitude: 11.0002 }, // "customers" er ikke privat
    ]);
  });

  test('bynavne: byer før landsbyer, og ikke to navne oven i hinanden', () => {
    expect(resort.towns).toEqual([
      { id: 'n502', name: 'Großstadt', latitude: 47.0005, longitude: 11.013 },
      { id: 'n501', name: 'Testdal', latitude: 47.0002, longitude: 10.9998 },
      // Unterdorf ligger 50 m fra Testdal, Weitweg er for langt væk, og en landsby uden navn kan ikke vises.
    ]);
  });

  test('kortudsnittet rummer lifter og pister - men ikke skitur-ruten langt væk', () => {
    expect(resort.region.latitude).toBeCloseTo(47.005, 6);
    expect(resort.region.longitude).toBeCloseTo(11.0045, 6);
    // Et lille område får et mindste udsnit, så kortet ikke zoomer helt ind.
    expect(resort.region.latitudeDelta).toBe(0.02);
    expect(resort.region.longitudeDelta).toBe(0.02);
  });

  test('vejret hentes ved den lavest liggende liftstation', () => {
    expect(resort.weatherPoint).toEqual({ latitude: 47, longitude: 11 });
    expect(resort.weatherElevation).toBe(1000);
  });

  test('det hentede område kan bruges af resten af appen', () => {
    const model = buildModel(resort);
    expect(model.defaultLift.name).toBe('Dorfbahn');
    expect(model.pisteKm).toBe(3);
    expect(model.sledRun.name).toBe('Rodelbahn');
    const bar = model.findPlace('n306'); // Kuhstall ved gondolens top
    const start = model.liftBottom(model.defaultLift);
    const route = findRoute(model.getGraph(), start, bar, { skill: 'none' });
    expect(route.steps[0]).toMatchObject({ kind: 'lift', name: 'Dorfbahn' });
    // Hjem igen på blå: ned ad Talabfahrt.
    const home = findRoute(model.getGraph(), bar, start, { skill: 'easy' });
    expect(home.steps.map((step) => step.name)).toContain('Talabfahrt');
    // Og det kan gemmes på telefonen og læses igen uændret.
    expect(unpackResort(JSON.parse(JSON.stringify(packResort(resort))))).toEqual(resort);
  });
});

describe('downloadResort - størrelsen på området', () => {
  test('små områder hentes med mindst 1500 m omkring midten', async () => {
    const fetchMock = servers();
    await settle(downloadResort({ ...testdal, radiusMeters: 300 }));
    const query = decodeURIComponent(fetchMock.mock.calls[0][1].body);
    const [south] = query.match(/\[bbox:([^\]]+)\]/)[1].split(',').map(Number);
    expect(distanceMeters({ latitude: south, longitude: 11.005 }, testdal.center)).toBeCloseTo(1500, -2);
  });

  test('"too_large": meget store områder hentes slet ikke', async () => {
    const fetchMock = servers();
    expect(MAX_RESORT_RADIUS_M).toBe(16000);
    const huge = { ...testdal, name: 'Les 3 Vallées', radiusMeters: MAX_RESORT_RADIUS_M + 1 };
    await expect(downloadResort(huge)).rejects.toMatchObject({
      code: 'too_large',
      message: 'Les 3 Vallées is too large to download.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    // Lige på grænsen går det.
    const { value } = await settle(downloadResort({ ...testdal, radiusMeters: MAX_RESORT_RADIUS_M }));
    expect(value.lifts).toHaveLength(2);
  });
});

describe('downloadResort - fejl', () => {
  test('"empty": OpenStreetMap har ingen lifter eller pister for området', async () => {
    const onlyPlaces = { elements: overpassFixture.elements.filter((element) => element.type !== 'way') };
    const fetchMock = servers({ overpass: () => jsonResponse(onlyPlaces) });
    const { error } = await settle(downloadResort(testdal));
    expect(error).toMatchObject({ code: 'empty', message: 'OpenStreetMap has no lifts or pistes for Testdal yet.' });
    // Der er ingen grund til at bruge af højde-kvoten, når der ikke er noget at slå op.
    expect(elevationCalls(fetchMock)).toEqual([]);
  });

  test('"empty": lifter uden pister er heller ikke et skiområde', async () => {
    const onlyLifts = { elements: overpassFixture.elements.filter((element) => element.tags.aerialway) };
    servers({ overpass: () => jsonResponse(onlyLifts) });
    expect((await settle(downloadResort(testdal))).error.code).toBe('empty');
    const onlyPistes = { elements: overpassFixture.elements.filter((element) => element.tags['piste:type']) };
    servers({ overpass: () => jsonResponse(onlyPistes) });
    expect((await settle(downloadResort(testdal))).error.code).toBe('empty');
    servers({ overpass: () => jsonResponse({ elements: [] }) });
    expect((await settle(downloadResort(testdal))).error.code).toBe('empty');
  });

  test('"network": ingen af de tre kortservere svarer', async () => {
    const fetchMock = servers({ overpass: noNet });
    const { error } = await settle(downloadResort(testdal));
    expect(error).toMatchObject({ code: 'network', message: 'Could not reach the map server.' });
    // Alle tre er prøvet, i rækkefølge - og ingen andre tjenester er spurgt.
    expect(calledUrls(fetchMock)).toEqual([KUMI, OVERPASS_DE, MAIL_RU]);
  });

  test('"network": også når serverne svarer med fejlkoder', async () => {
    const fetchMock = servers({ overpass: () => jsonResponse({}, 504) });
    expect((await settle(downloadResort(testdal))).error.code).toBe('network');
    expect(overpassCalls(fetchMock)).toHaveLength(3);
  });

  test('"busy": højde-tjenesten svarer 429 (kvoten er brugt)', async () => {
    const fetchMock = servers({ elevation: () => jsonResponse({ error: true, reason: 'Too many requests' }, 429) });
    const started = Date.now();
    const { error } = await settle(downloadResort(testdal));
    expect(error).toMatchObject({ code: 'busy', message: 'The elevation service is busy.' });
    // Tre forsøg med 20 sekunders pause efter hvert - derefter opgives der.
    expect(elevationCalls(fetchMock)).toHaveLength(3);
    expect(Date.now() - started).toBeGreaterThanOrEqual(60000);
    expect(Date.now() - started).toBeLessThan(62000);
  });

  test('"busy": mangler bare én lift sin højde, gemmes området ikke halvt', async () => {
    // Højde-tjenesten kender ikke T2-liftens bund (47.004, 11.01).
    const elevation = (url) =>
      jsonResponse({
        elevation: pointsIn(url).map((p) => (p.latitude === 47.004 && p.longitude === 11.01 ? null : heightAt(p.latitude))),
      });
    servers({ elevation });
    expect((await settle(downloadResort(testdal))).error.code).toBe('busy');
  });

  test('mangler kun en pist sin højde, hentes området alligevel', async () => {
    // "Family Run" ender i (47.004, 10.998), som højde-tjenesten ikke kender.
    const elevation = (url) =>
      jsonResponse({
        elevation: pointsIn(url).map((p) => (p.longitude === 10.998 ? null : heightAt(p.latitude))),
      });
    servers({ elevation });
    const { value } = await settle(downloadResort(testdal));
    expect(value.elevations.w207).toBeUndefined();
    expect(Object.keys(value.elevations).sort()).toEqual(['w101', 'w102', 'w201', 'w202', 'w206', 'w208']);
  });

  test('en enkelt fejl fra højde-tjenesten prøves igen', async () => {
    let calls = 0;
    const fetchMock = servers({
      elevation: (url) => {
        calls += 1;
        return calls === 1 ? jsonResponse({}, 500) : elevationOk(url);
      },
    });
    const { value } = await settle(downloadResort(testdal));
    expect(value.elevations.w101).toEqual([1000, 2000]);
    expect(elevationCalls(fetchMock)).toHaveLength(2);
  });

  test('hænger højde-tjenesten, opgives kaldet efter 20 sekunder og prøves igen', async () => {
    let calls = 0;
    const fetchMock = servers({
      elevation: (url, options) => {
        calls += 1;
        return calls === 1 ? hanging(options) : elevationOk(url);
      },
    });
    const started = Date.now();
    const { value } = await settle(downloadResort(testdal));
    expect(value.elevations.w101).toEqual([1000, 2000]);
    expect(elevationCalls(fetchMock)).toHaveLength(2);
    expect(Date.now() - started).toBeGreaterThanOrEqual(20000);
  });

  test('uden tidszone hentes området stadig - så bruger "Open now" telefonens tid', async () => {
    servers({ forecast: () => jsonResponse({}, 500) });
    expect((await settle(downloadResort(testdal))).value.timeZone).toBeNull();
    servers({ forecast: noNet });
    expect((await settle(downloadResort(testdal))).value.timeZone).toBeNull();
    servers({ forecast: () => jsonResponse({}) });
    expect((await settle(downloadResort(testdal))).value.timeZone).toBeNull();
  });
});

describe('downloadResort - de tre Overpass-servere', () => {
  // Samme område, men med et andet liftnavn, så vi kan se, hvilken servers svar der blev brugt.
  const answerFrom = (label) =>
    jsonResponse({
      elements: overpassFixture.elements.map((element) =>
        element.id === 101 ? { ...element, tags: { ...element.tags, name: `Dorfbahn (${label})` } } : element
      ),
    });
  const gondolaName = (resort) => resort.lifts[0].name;

  test('svarer den første, spørges de andre aldrig', async () => {
    const fetchMock = servers();
    await settle(downloadResort(testdal));
    await advance(120000);
    expect(overpassCalls(fetchMock)).toEqual([KUMI]);
  });

  test('fejler den første med det samme, spørges den næste straks - uden at vente 15 sekunder', async () => {
    const fetchMock = servers({ overpass: (url) => (url === KUMI ? noNet() : answerFrom('second')) });
    const promise = downloadResort(testdal);
    await advance(1);
    expect(overpassCalls(fetchMock)).toEqual([KUMI, OVERPASS_DE]);
    const { value } = await settle(promise);
    expect(gondolaName(value)).toBe('Dorfbahn (second)');
    // Den tredje blev aldrig spurgt - heller ikke senere.
    await advance(120000);
    expect(overpassCalls(fetchMock)).toEqual([KUMI, OVERPASS_DE]);
  });

  test('en fejlkode fra den første sender også straks kaldet videre', async () => {
    const fetchMock = servers({ overpass: (url) => (url === KUMI ? jsonResponse({}, 429) : answerFrom('second')) });
    const promise = downloadResort(testdal);
    await advance(1);
    expect(overpassCalls(fetchMock)).toEqual([KUMI, OVERPASS_DE]);
    expect(gondolaName((await settle(promise)).value)).toBe('Dorfbahn (second)');
  });

  test('et halvt svar (200 med "remark") bruges ikke', async () => {
    // En overbelastet server svarer 200 med en fejltekst og kun en del af dataene.
    const partial = jsonResponse({
      elements: overpassFixture.elements.slice(0, 4),
      remark: 'runtime error: Query timed out in "query" at line 3 after 61 seconds.',
    });
    const fetchMock = servers({ overpass: (url) => (url === KUMI ? partial : answerFrom('second')) });
    const { value } = await settle(downloadResort(testdal));
    expect(overpassCalls(fetchMock)).toEqual([KUMI, OVERPASS_DE]);
    expect(gondolaName(value)).toBe('Dorfbahn (second)');
    expect(value.places).toHaveLength(6);
  });

  test('et svar uden "elements" bruges heller ikke', async () => {
    const fetchMock = servers({ overpass: (url) => (url === KUMI ? jsonResponse({}) : answerFrom('second')) });
    const { value } = await settle(downloadResort(testdal));
    expect(overpassCalls(fetchMock)).toEqual([KUMI, OVERPASS_DE]);
    expect(gondolaName(value)).toBe('Dorfbahn (second)');
  });

  test('fejler de to første, bruges den tredje', async () => {
    const fetchMock = servers({
      overpass: (url) => {
        if (url === KUMI) return noNet();
        if (url === OVERPASS_DE) return jsonResponse({}, 504);
        return answerFrom('third');
      },
    });
    const { value } = await settle(downloadResort(testdal));
    expect(overpassCalls(fetchMock)).toEqual([KUMI, OVERPASS_DE, MAIL_RU]);
    expect(gondolaName(value)).toBe('Dorfbahn (third)');
  });

  test('er den første længe om det, spørges den næste efter 15 sekunder - og den første afbrydes', async () => {
    const fetchMock = servers({ overpass: (url, options) => (url === KUMI ? hanging(options) : answerFrom('second')) });
    const promise = downloadResort(testdal);
    await advance(14999);
    expect(overpassCalls(fetchMock)).toEqual([KUMI]);
    await advance(1);
    expect(overpassCalls(fetchMock)).toEqual([KUMI, OVERPASS_DE]);
    const { value } = await settle(promise);
    expect(gondolaName(value)).toBe('Dorfbahn (second)');
    // Kaldet til den langsomme server er afbrudt, så det ikke bruger data i baggrunden.
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    await advance(120000);
    expect(overpassCalls(fetchMock)).toEqual([KUMI, OVERPASS_DE]);
  });

  test('den langsomme første server kan stadig nå at vinde', async () => {
    // Første server svarer efter 20 sekunder; den anden (spurgt efter 15) svarer aldrig.
    const slow = deferred();
    const fetchMock = servers({ overpass: (url, options) => (url === KUMI ? slow.promise : hanging(options)) });
    const promise = downloadResort(testdal);
    await advance(20000);
    expect(overpassCalls(fetchMock)).toEqual([KUMI, OVERPASS_DE]);
    slow.resolve(answerFrom('first'));
    const { value } = await settle(promise);
    expect(gondolaName(value)).toBe('Dorfbahn (first)');
    expect(fetchMock.mock.calls[1][1].signal.aborted).toBe(true);
    // Den tredje (der skulle spørges efter 30 sekunder) blev aldrig spurgt.
    await advance(120000);
    expect(overpassCalls(fetchMock)).toEqual([KUMI, OVERPASS_DE]);
  });

  test('et sent svar fra den første server ændrer ingenting, når den anden har vundet', async () => {
    // Denne første server lader sig ikke afbryde og svarer længe efter.
    const late = deferred();
    const fetchMock = servers({ overpass: (url) => (url === KUMI ? late.promise : answerFrom('second')) });
    const { value } = await settle(downloadResort(testdal));
    expect(gondolaName(value)).toBe('Dorfbahn (second)');
    const callsBefore = fetchMock.mock.calls.length;

    late.resolve(answerFrom('first'));
    await advance(120000);
    // Ingen nye kald (hverken til Overpass eller til højder), og resultatet er det samme.
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
    expect(overpassCalls(fetchMock)).toEqual([KUMI, OVERPASS_DE]);
    expect(gondolaName(value)).toBe('Dorfbahn (second)');
  });

  test('en sen fejl fra den første server sætter ikke den tredje i gang', async () => {
    const late = deferred();
    const fetchMock = servers({ overpass: (url) => (url === KUMI ? late.promise : answerFrom('second')) });
    const { value } = await settle(downloadResort(testdal));
    const callsBefore = fetchMock.mock.calls.length;

    late.reject(new TypeError('Network request failed'));
    await advance(120000);
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
    expect(gondolaName(value)).toBe('Dorfbahn (second)');
  });

  test('hænger alle tre, spørges de med 15 sekunders mellemrum, og hver får 80 sekunder', async () => {
    const fetchMock = servers({ overpass: (url, options) => hanging(options) });
    const started = Date.now();
    const promise = downloadResort(testdal);
    await advance(1);
    expect(overpassCalls(fetchMock)).toEqual([KUMI]);
    await advance(15000);
    expect(overpassCalls(fetchMock)).toEqual([KUMI, OVERPASS_DE]);
    await advance(15000);
    expect(overpassCalls(fetchMock)).toEqual([KUMI, OVERPASS_DE, MAIL_RU]);
    const { error } = await settle(promise);
    expect(error.code).toBe('network');
    // Den sidste blev spurgt efter 30 sekunder og opgivet 80 sekunder senere.
    expect(Date.now() - started).toBeGreaterThanOrEqual(110000);
    expect(Date.now() - started).toBeLessThan(112000);
    expect(overpassCalls(fetchMock)).toHaveLength(3);
    expect(fetchMock.mock.calls.every(([, options]) => options.signal.aborted)).toBe(true);
  });

  test('hænger den første, og fejler den anden straks, spørges den tredje med det samme', async () => {
    const fetchMock = servers({
      overpass: (url, options) => {
        if (url === KUMI) return hanging(options);
        if (url === OVERPASS_DE) return noNet();
        return answerFrom('third');
      },
    });
    const promise = downloadResort(testdal);
    await advance(15001);
    expect(overpassCalls(fetchMock)).toEqual([KUMI, OVERPASS_DE, MAIL_RU]);
    expect(gondolaName((await settle(promise)).value)).toBe('Dorfbahn (third)');
  });
});

describe('downloadResort - store områder og højde-kvoten', () => {
  // 260 lifter med hver sin top og bund = 520 højdepunkter, plus én pist.
  const bigArea = () => {
    const elements = [];
    for (let i = 0; i < 260; i++) {
      const lat = 47 + (i % 20) * 0.002;
      const lon = 11 + Math.floor(i / 20) * 0.003;
      elements.push({
        type: 'way',
        id: 1000 + i,
        tags: { aerialway: 'chair_lift', name: `Lift ${i}` },
        geometry: [
          { lat, lon },
          { lat: lat + 0.001, lon },
        ],
      });
    }
    elements.push({
      type: 'way',
      id: 5000,
      tags: { 'piste:type': 'downhill', 'piste:difficulty': 'easy', name: 'Lang' },
      geometry: [
        { lat: 47.0505, lon: 11.0505 },
        { lat: 47.0405, lon: 11.0505 },
      ],
    });
    return { elements };
  };

  test('højst 100 punkter pr. kald; de første 500 hentes straks, resten i roligt tempo', async () => {
    const fetchMock = servers({ overpass: () => jsonResponse(bigArea()) });
    const progress = [];
    const promise = downloadResort(testdal, (text) => progress.push(text));

    // Fem kald (500 punkter) går af sted med 150 ms imellem ...
    await advance(5000);
    expect(elevationCalls(fetchMock)).toHaveLength(5);
    // ... det sjette venter 10,5 sekunder, så minut-kvoten ikke sprænges.
    await advance(6000);
    expect(elevationCalls(fetchMock)).toHaveLength(5);
    await advance(1000);
    expect(elevationCalls(fetchMock)).toHaveLength(6);

    const { value } = await settle(promise);
    expect(elevationCalls(fetchMock).map((url) => pointsIn(url).length)).toEqual([100, 100, 100, 100, 100, 22]);
    expect(value.lifts).toHaveLength(260);
    expect(Object.keys(value.elevations)).toHaveLength(261);
    expect(value.elevations.w1000).toEqual([1000, 1100]);
    expect(progress).toContain('Looking up elevations... 19%');
    expect(progress[progress.length - 2]).toBe('Looking up elevations... 100%');
  });

  test('løber kvoten tør undervejs, opgives der efter fire afslag i alt', async () => {
    // De to første kald går godt, derefter svarer tjenesten 429 på alt.
    let calls = 0;
    const fetchMock = servers({
      overpass: () => jsonResponse(bigArea()),
      elevation: (url) => {
        calls += 1;
        return calls <= 2 ? elevationOk(url) : jsonResponse({}, 429);
      },
    });
    const { error } = await settle(downloadResort(testdal));
    expect(error.code).toBe('busy');
    // 2 gode + 3 forsøg på tredje kald + 1 på fjerde = 6. Resten af de 522 punkter spørges der ikke om.
    expect(elevationCalls(fetchMock)).toHaveLength(6);
  });
});
