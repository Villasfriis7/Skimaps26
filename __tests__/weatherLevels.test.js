import { buildModel, pickWeatherLevels } from '../utils/resortModel';
import { fetchWeather } from '../data/weather';
import { verbier } from '../data/resorts/verbier';

// Vejret oppe på bjerget står på to ben: valget af højder (resortModel) og
// ét samlet kald til Open-Meteo (weather). Begge dele kan gå galt uden at
// appen crasher - fx "Mid-mountain" lige ved siden af landsbyen - så det er
// reglerne, der testes her, ikke skærmene.

// En liftstation, som buildModel() laver dem: et punkt med en højde.
const station = (latitude, longitude, elevation) => ({ latitude, longitude, elevation });
const VILLAGE = { point: { latitude: 46.0, longitude: 7.0 }, elevation: 1500 };

describe('pickWeatherLevels', () => {
  test('giver landsby, midt og top i den rækkefølge', () => {
    const levels = pickWeatherLevels(VILLAGE, [
      station(46.0, 7.0, 1500),
      station(46.01, 7.01, 2050),
      station(46.02, 7.02, 2600),
      station(46.015, 7.015, 2300),
    ]);
    expect(levels.map((level) => level.id)).toEqual(['village', 'mid', 'top']);
    expect(levels.map((level) => level.label)).toEqual(['Village', 'Mid-mountain', 'Top']);
    expect(levels.map((level) => level.elevation)).toEqual([1500, 2050, 2600]);
    expect(levels[2].point).toEqual({ latitude: 46.02, longitude: 7.02 });
    expect(levels[0].point).toEqual(VILLAGE.point);
  });

  test('kun landsbyen, når ingen lifter har en højde', () => {
    const levels = pickWeatherLevels(VILLAGE, [station(46.01, 7.01, undefined), station(46.02, 7.02, null)]);
    expect(levels).toEqual([{ id: 'village', label: 'Village', point: VILLAGE.point, elevation: 1500 }]);
    expect(pickWeatherLevels(VILLAGE, [])).toHaveLength(1);
  });

  test('kun landsbyen, når toppen ligger under 150 m over den', () => {
    const levels = pickWeatherLevels(VILLAGE, [station(46.0, 7.0, 1500), station(46.01, 7.01, 1649)]);
    expect(levels.map((level) => level.id)).toEqual(['village']);
    // 150 m er nok.
    const enough = pickWeatherLevels(VILLAGE, [station(46.0, 7.0, 1500), station(46.01, 7.01, 1650)]);
    expect(enough.map((level) => level.id)).toEqual(['village', 'top']);
  });

  test('stationer uden højde springes over', () => {
    const levels = pickWeatherLevels(VILLAGE, [
      station(46.03, 7.03, undefined),
      station(46.01, 7.01, 2000),
      station(46.02, 7.02, 2500),
    ]);
    expect(levels.map((level) => level.elevation)).toEqual([1500, 2000, 2500]);
  });

  test('ingen "Mid-mountain", når ingen station ligger midt på bjerget', () => {
    // Én lift fra byen til toppen plus et børnebånd lige over byen.
    const levels = pickWeatherLevels(VILLAGE, [
      station(46.0, 7.0, 1500),
      station(46.001, 7.001, 1520),
      station(46.02, 7.02, 2500),
    ]);
    expect(levels.map((level) => level.id)).toEqual(['village', 'top']);
  });

  test('aldrig to højder i samme punkt', () => {
    // To lifter mødes på toppen: nabostationen må ikke blive "midt".
    const levels = pickWeatherLevels(VILLAGE, [
      station(46.0, 7.0, 1500),
      station(46.02, 7.02, 2100),
      station(46.0201, 7.0201, 2000),
    ]);
    expect(levels.map((level) => level.id)).toEqual(['village', 'top']);
    // Og ligger "toppen" i selve landsbypunktet, er der kun landsbyen.
    const same = pickWeatherLevels({ point: VILLAGE.point, elevation: 1000 }, [station(46.0, 7.0, 1500)]);
    expect(same.map((level) => level.id)).toEqual(['village']);
  });

  test('blandt lige høje stationer vælges den mellem landsbyen og toppen', () => {
    // Højderne er omtrentlige (ca. 90 m opløsning), så 2040 og 2060 er lige
    // tæt på halvvejs (2050) - den i nabodalen må ikke vinde på 2 meter.
    const levels = pickWeatherLevels(VILLAGE, [
      station(46.0, 7.0, 1500),
      station(46.02, 7.02, 2600),
      station(46.2, 7.3, 2048), // nabodalen, langt væk
      station(46.01, 7.01, 2060), // på vejen op
    ]);
    expect(levels[1].elevation).toBe(2060);
  });

  test('uden landsbyens højde regnes der fra den laveste station', () => {
    const levels = pickWeatherLevels({ point: VILLAGE.point, elevation: null }, [
      station(46.001, 7.001, 1400),
      station(46.01, 7.01, 1900),
      station(46.02, 7.02, 2400),
    ]);
    expect(levels.map((level) => level.elevation)).toEqual([null, 1900, 2400]);
  });
});

describe('buildModel().weatherLevels', () => {
  test('Verbier: landsbyen i 1500 m, toppen over 3000 m', () => {
    const model = buildModel(verbier);
    const [village, mid, top] = model.weatherLevels;
    expect(model.weatherLevels.map((level) => level.id)).toEqual(['village', 'mid', 'top']);
    expect(village.elevation).toBe(1500);
    expect(village.point).toEqual(verbier.weatherPoint);
    expect(top.elevation).toBeGreaterThan(3000);
    expect(mid.elevation).toBeGreaterThan(village.elevation);
    expect(mid.elevation).toBeLessThan(top.elevation);
    // Resten af appen bruger stadig weatherPoint.
    expect(model.weatherPoint).toEqual(verbier.weatherPoint);
  });

  test('hentet område: landsbyen er hovedliftens bundstation med dens højde', () => {
    const lift = (id, from, to) => ({
      id,
      name: id,
      liftType: 'chair_lift',
      coordinates: [
        { latitude: from[0], longitude: from[1] },
        { latitude: to[0], longitude: to[1] },
      ],
    });
    const resort = {
      id: 'test',
      name: 'Test',
      // Som utils/resortData.js: den lavest liggende station - ikke byen.
      weatherPoint: { latitude: 45.9, longitude: 6.9 },
      weatherElevation: 900,
      // Den øverste lift er tegnet oppefra og ned.
      lifts: [lift('a', [46.0, 7.0], [46.01, 7.01]), lift('b', [46.02, 7.02], [46.01, 7.01])],
      pistes: [],
      places: [],
      elevations: { a: [1200, 1700], b: [2200, 1700] },
    };
    const model = buildModel(resort);
    expect(model.weatherLevels).toEqual([
      { id: 'village', label: 'Village', point: { latitude: 46.0, longitude: 7.0 }, elevation: 1200 },
      { id: 'mid', label: 'Mid-mountain', point: { latitude: 46.01, longitude: 7.01 }, elevation: 1700 },
      { id: 'top', label: 'Top', point: { latitude: 46.02, longitude: 7.02 }, elevation: 2200 },
    ]);

    // Helt uden højder (ældre gemte områder) er der stadig en landsby.
    const flat = buildModel({ ...resort, elevations: undefined });
    expect(flat.weatherLevels).toEqual([
      { id: 'village', label: 'Village', point: { latitude: 46.0, longitude: 7.0 }, elevation: null },
    ]);
  });
});

// Et svar formet som Open-Meteos (tallene er fra et rigtigt svar for Verbier
// 25/11-2026). Ét punkt giver ét objekt, flere punkter en liste.
const location = (elevation, temperature, now = {}) => ({
  elevation,
  current: {
    temperature_2m: temperature,
    weather_code: 71,
    wind_speed_10m: 7.5,
    wind_gusts_10m: 25.6,
    snowfall: 0,
    relative_humidity_2m: 89,
    snow_depth: 0.83,
    is_day: 0,
    freezing_level_height: 1720,
    ...now,
  },
  daily: {
    time: ['2026-11-25', '2026-11-26'],
    weather_code: [85, 3],
    temperature_2m_max: [2.9, -0.3],
    temperature_2m_min: [-0.8, -2.2],
    snowfall_sum: [0.49, 1.82],
    precipitation_probability_max: [90, 100],
  },
});

// Bytter fetch ud med et fast svar, mens `run` kører, og husker adresserne.
async function withFetch(body, run, ok = true) {
  const realFetch = global.fetch;
  const urls = [];
  global.fetch = async (url) => {
    urls.push(url);
    return { ok, json: async () => body };
  };
  try {
    return await run(urls);
  } finally {
    global.fetch = realFetch;
  }
}

const LEVELS = [
  { id: 'village', label: 'Village', point: { latitude: 46.0961, longitude: 7.2286 }, elevation: 1500 },
  { id: 'mid', label: 'Mid-mountain', point: { latitude: 46.08755, longitude: 7.26454 }, elevation: 2418 },
  { id: 'top', label: 'Top', point: { latitude: 46.08008, longitude: 7.31826 }, elevation: 3253 },
];

describe('fetchWeather', () => {
  test('henter alle højder i ét kald og beholder landsbyens form', async () => {
    const body = [
      location(1500, 0.8, { wind_speed_10m: 1.0, wind_gusts_10m: 3.2, snow_depth: 0.17 }),
      location(2418, -4.7, { freezing_level_height: 2130 }),
      location(3253, -9.6, { wind_speed_10m: 16.1, wind_gusts_10m: 29.5, snow_depth: 0.66, freezing_level_height: 2430 }),
    ];
    await withFetch(body, async (urls) => {
      const weather = await fetchWeather(LEVELS);
      expect(urls).toHaveLength(1);
      expect(urls[0]).toContain('latitude=46.0961,46.08755,46.08008&longitude=7.2286,7.26454,7.31826');
      expect(urls[0]).toContain('&elevation=1500,2418,3253&');
      expect(urls[0]).toContain('wind_gusts_10m');

      // Det, resten af appen allerede bruger, er landsbyens tal.
      expect(weather.current.temperature).toBe(1);
      expect(weather.current.snowDepthCm).toBe(17);
      expect(weather.current.snowConditions).toBe('Packed snow');
      expect(weather.daily).toHaveLength(2);
      expect(weather.elevation).toBe(1500);
      expect(typeof weather.fetchedAt).toBe('number');

      expect(weather.levels).toEqual([
        { id: 'village', label: 'Village', elevation: 1500, temperature: 1, windSpeed: 1, windGusts: 3, snowDepthCm: 17, code: 71, isDay: false },
        { id: 'mid', label: 'Mid-mountain', elevation: 2418, temperature: -5, windSpeed: 8, windGusts: 26, snowDepthCm: 83, code: 71, isDay: false },
        { id: 'top', label: 'Top', elevation: 3253, temperature: -10, windSpeed: 16, windGusts: 30, snowDepthCm: 66, code: 71, isDay: false },
      ]);
      // Frysepunktet er landsbyens tal - ikke toppens, som bare er modellens terræn.
      expect(weather.freezingLevelM).toBe(1720);
    });
  });

  test('virker stadig med ét punkt', async () => {
    await withFetch(location(1494, 0.9, { snow_depth: 0.17 }), async (urls) => {
      const weather = await fetchWeather({ latitude: 46.0961, longitude: 7.2286 });
      expect(urls[0]).toContain('latitude=46.0961&longitude=7.2286&current=');
      expect(urls[0]).not.toContain('elevation=');
      expect(weather.current.temperature).toBe(1);
      expect(weather.elevation).toBe(1494);
      expect(weather.levels).toHaveLength(1);
      expect(weather.levels[0].id).toBe('village');
      expect(weather.levels[0].elevation).toBe(1494);
    });
  });

  test('sender ingen højder, hvis bare én mangler', async () => {
    // Open-Meteo kræver lige lange lister.
    const levels = [{ ...LEVELS[0], elevation: null }, LEVELS[2]];
    await withFetch([location(1494, 0.9), location(3253, -9.6)], async (urls) => {
      const weather = await fetchWeather(levels);
      expect(urls[0]).not.toContain('elevation=');
      expect(weather.levels.map((level) => level.elevation)).toEqual([1494, 3253]);
    });
  });

  test('manglende tal bliver null og ikke 0', async () => {
    const body = [location(1500, 0.8), location(3253, -9.6, { wind_gusts_10m: null, snow_depth: null })];
    await withFetch(body, async () => {
      const weather = await fetchWeather([LEVELS[0], LEVELS[2]]);
      expect(weather.levels[1].windGusts).toBeNull();
      expect(weather.levels[1].snowDepthCm).toBeNull();
      expect(weather.levels[1].temperature).toBe(-10);
    });
  });

  test('intet frysepunkt, når det fryser i alle højder', async () => {
    await withFetch([location(1500, -2.1), location(3253, -12)], async () => {
      const weather = await fetchWeather([LEVELS[0], LEVELS[2]]);
      expect(weather.freezingLevelM).toBeNull();
    });
  });

  test('fejler som før, når Open-Meteo svarer med en fejl', async () => {
    await withFetch(
      {},
      async () => {
        await expect(fetchWeather(LEVELS)).rejects.toThrow('Could not fetch weather data');
      },
      false
    );
  });
});
