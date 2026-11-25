import { weatherCodeMeta, snowConditionLabel, formatCm, formatUpdated, fetchWeather } from '../data/weather';
import { installFetch, jsonResponse, hanging, settle } from './helpers/fetchMock';

// Vejret fra Open-Meteo. Selve kaldet er erstattet af et håndlavet svar
// (__tests__/fixtures/open-meteo-forecast.json) - testene bruger ikke nettet.

const forecast = require('./fixtures/open-meteo-forecast.json');
const verbierVillage = { latitude: 46.0961, longitude: 7.2286 };

describe('weatherCodeMeta - WMO-koder til ikon og tekst', () => {
  test.each([
    [0, 'sunny-outline', 'Sunny'],
    [1, 'partly-sunny-outline', 'Mostly clear'],
    [2, 'partly-sunny-outline', 'Partly cloudy'],
    [3, 'cloudy-outline', 'Cloudy'],
    [45, 'cloud-outline', 'Fog'],
    [48, 'cloud-outline', 'Fog'],
    [51, 'rainy-outline', 'Drizzle'],
    [57, 'rainy-outline', 'Drizzle'],
    [61, 'rainy-outline', 'Rain'],
    [67, 'rainy-outline', 'Rain'],
    [82, 'rainy-outline', 'Rain'],
    [71, 'snow-outline', 'Snow'],
    [77, 'snow-outline', 'Snow'],
    [86, 'snow-outline', 'Snow'],
    [95, 'thunderstorm-outline', 'Thunderstorm'],
    [99, 'thunderstorm-outline', 'Thunderstorm'],
  ])('kode %d om dagen', (code, icon, label) => {
    expect(weatherCodeMeta(code)).toEqual({ icon, label });
    expect(weatherCodeMeta(code, true)).toEqual({ icon, label });
  });

  test('om natten er solen en måne', () => {
    expect(weatherCodeMeta(0, false)).toEqual({ icon: 'moon-outline', label: 'Clear' });
    expect(weatherCodeMeta(1, false)).toEqual({ icon: 'moon-outline', label: 'Mostly clear' });
    expect(weatherCodeMeta(2, false)).toEqual({ icon: 'cloudy-night-outline', label: 'Partly cloudy' });
    // Sne er sne, dag og nat.
    expect(weatherCodeMeta(73, false)).toEqual({ icon: 'snow-outline', label: 'Snow' });
  });

  test('en kode, vi ikke kender, giver "Unknown" i stedet for at gå ned', () => {
    expect(weatherCodeMeta(4)).toEqual({ icon: 'thermometer-outline', label: 'Unknown' });
    expect(weatherCodeMeta(undefined)).toEqual({ icon: 'thermometer-outline', label: 'Unknown' });
    expect(weatherCodeMeta(null, false)).toEqual({ icon: 'thermometer-outline', label: 'Unknown' });
  });
});

describe('snowConditionLabel', () => {
  test.each([
    [{ snowDepthCm: 80, snowfallTodayCm: 12, temperature: -5 }, 'Fresh powder'],
    [{ snowDepthCm: 80, snowfallTodayCm: 10, temperature: -5 }, 'Fresh powder'],
    [{ snowDepthCm: 80, snowfallTodayCm: 9.9, temperature: -5 }, 'Fresh snow'],
    [{ snowDepthCm: 80, snowfallTodayCm: 2, temperature: -5 }, 'Fresh snow'],
    [{ snowDepthCm: 80, snowfallTodayCm: 1.9, temperature: -5 }, 'Packed snow'],
    [{ snowDepthCm: 80, snowfallTodayCm: 0, temperature: 5 }, 'Packed snow'],
    [{ snowDepthCm: 80, snowfallTodayCm: 0, temperature: 5.1 }, 'Soft snow'],
    [{ snowDepthCm: 5, snowfallTodayCm: 0, temperature: 8 }, 'Soft snow'],
  ])('%p -> "%s"', (numbers, label) => {
    expect(snowConditionLabel(numbers)).toBe(label);
  });

  test('uden sne i byen påstås der ikke "Packed snow"', () => {
    expect(snowConditionLabel({ snowDepthCm: 0, snowfallTodayCm: 0, temperature: -5 })).toBe(
      'Little or no snow in the village'
    );
    expect(snowConditionLabel({ snowDepthCm: 4, snowfallTodayCm: 1, temperature: 10 })).toBe(
      'Little or no snow in the village'
    );
  });

  test('dagens snefald går forud for alt andet', () => {
    // Nysne på bar jord i tøvejr er stadig nysne.
    expect(snowConditionLabel({ snowDepthCm: 0, snowfallTodayCm: 15, temperature: 6 })).toBe('Fresh powder');
  });
});

describe('formatCm', () => {
  test.each([
    [0, 0],
    [0.04, 0],
    [0.56, 0.6],
    [4.01, 4],
    [4.25, 4.3],
    [9.94, 9.9],
    [10, 10],
    [12.6, 13],
    [47.4, 47],
  ])('%p cm vises som %p', (cm, shown) => {
    expect(formatCm(cm)).toBe(shown);
  });
});

describe('formatUpdated', () => {
  test('klokkeslæt med to cifre i telefonens egen tid', () => {
    expect(formatUpdated(new Date(2026, 0, 5, 14, 5).getTime())).toBe('14:05');
    expect(formatUpdated(new Date(2026, 0, 5, 0, 0).getTime())).toBe('00:00');
    expect(formatUpdated(new Date(2026, 0, 5, 9, 59))).toBe('09:59');
  });
});

describe('fetchWeather', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-05T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('spørger Open-Meteo om vejret for skiområdets punkt', async () => {
    const fetchMock = installFetch(() => jsonResponse(forecast));
    await fetchWeather(verbierVillage);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/^https:\/\/api\.open-meteo\.com\/v1\/forecast\?latitude=46\.0961&longitude=7\.2286&/);
    expect(url).toContain('current=temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m,snowfall,relative_humidity_2m,snow_depth,is_day,freezing_level_height');
    expect(url).toContain('daily=weather_code,temperature_2m_max,temperature_2m_min,snowfall_sum,precipitation_probability_max');
    expect(url).toContain('timezone=auto');
    expect(url).toContain('forecast_days=6');
    // Kaldet kan afbrydes (se timeout-testen nederst).
    expect(options.signal).toBeDefined();
  });

  test('vejret lige nu: afrundede tal, snedybde i cm og en tekst om sneen', async () => {
    installFetch(() => jsonResponse(forecast));
    const weather = await fetchWeather(verbierVillage);
    expect(weather.current).toEqual({
      temperature: -4, // -3.6
      windSpeed: 12, // 12.4
      humidity: 81,
      code: 73,
      isDay: true,
      snowDepthCm: 47, // 0.47 m
      snowfallTodayCm: 4.01, // dagens samlede snefald, ikke det seneste kvarter
      snowConditions: 'Fresh snow',
    });
  });

  test('seks dages udsigt', async () => {
    installFetch(() => jsonResponse(forecast));
    const { daily } = await fetchWeather(verbierVillage);
    expect(daily).toHaveLength(6);
    expect(daily[0]).toEqual({ date: '2026-01-05', code: 73, max: -1, min: -8, snowfallCm: 4.01, precipProbability: 90 });
    expect(daily[5]).toEqual({ date: '2026-01-10', code: 85, max: -4, min: -11, snowfallCm: 12.6, precipProbability: 95 });
    expect(daily.map((day) => day.date)).toEqual(forecast.daily.time);
  });

  test('modellens højde og tidspunktet for hentningen følger med', async () => {
    installFetch(() => jsonResponse(forecast));
    const weather = await fetchWeather(verbierVillage);
    expect(weather.elevation).toBe(1496);
    expect(weather.fetchedAt).toBe(new Date('2026-01-05T12:00:00Z').getTime());
  });

  test('manglende tal fra Open-Meteo vælter ikke appen', async () => {
    const sparse = {
      ...forecast,
      elevation: undefined,
      current: { ...forecast.current, snow_depth: null, is_day: 0 },
      daily: { ...forecast.daily, snowfall_sum: [null, 0, 0, 0, 1.4, 12.6] },
    };
    installFetch(() => jsonResponse(sparse));
    const weather = await fetchWeather(verbierVillage);
    expect(weather.elevation).toBeNull();
    expect(weather.current).toMatchObject({
      snowDepthCm: 0,
      snowfallTodayCm: 0,
      isDay: false,
      snowConditions: 'Little or no snow in the village',
    });
  });

  test('svarer serveren med en fejl, kastes "Could not fetch weather data"', async () => {
    installFetch(() => jsonResponse({ error: true, reason: 'Too many requests' }, 429));
    await expect(fetchWeather(verbierVillage)).rejects.toThrow('Could not fetch weather data');
    installFetch(() => jsonResponse({}, 500));
    await expect(fetchWeather(verbierVillage)).rejects.toThrow('Could not fetch weather data');
  });

  test('uden net kastes fejlen videre', async () => {
    installFetch(() => {
      throw new TypeError('Network request failed');
    });
    await expect(fetchWeather(verbierVillage)).rejects.toThrow('Network request failed');
  });

  test('hænger kaldet, afbrydes det efter 10 sekunder - så skærmen kan vise "prøv igen"', async () => {
    const fetchMock = installFetch((url, options) => hanging(options));
    const promise = fetchWeather(verbierVillage);
    let settled = false;
    promise.catch(() => {}).then(() => {
      settled = true;
    });

    await jest.advanceTimersByTimeAsync(9999);
    expect(settled).toBe(false);
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(false);

    await jest.advanceTimersByTimeAsync(1);
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });

  test('uret, der afbryder kaldet, ryddes op, når svaret kommer - og når det fejler', async () => {
    installFetch(() => jsonResponse(forecast));
    await fetchWeather(verbierVillage);
    expect(jest.getTimerCount()).toBe(0);

    installFetch(() => jsonResponse({}, 500));
    const { error } = await settle(fetchWeather(verbierVillage));
    expect(error).toBeDefined();
    expect(jest.getTimerCount()).toBe(0);
  });

  test('et svar i en uventet form kaster en fejl i stedet for at give forkerte tal', async () => {
    installFetch(() => jsonResponse({ error: true }));
    await expect(fetchWeather(verbierVillage)).rejects.toThrow();
  });
});
