// Rigtig vejr-/snedata via Open-Meteo (gratis, ingen API-nøgle,
// ikke-kommerciel brug - fint til dette skoleprojekt). Vejret hentes for
// skiområdets landsby og - når området har højdemeter nok - også for midt på
// bjerget og toppen (`model.weatherLevels`), ikke brugerens telefon-placering.
// Open-Meteo kræver kildeangivelse (CC BY 4.0) - den vises på WeatherDetailScreen.
const FETCH_TIMEOUT_MS = 10000;

// WMO weather-koder (bruges af Open-Meteo) oversat til ikon (Ionicons) + tekst.
// `isDay` bruges kun til at vælge måne i stedet for sol om natten.
export const weatherCodeMeta = (code, isDay = true) => {
  if (code === 0) return isDay ? { icon: 'sunny-outline', label: 'Sunny' } : { icon: 'moon-outline', label: 'Clear' };
  if (code === 1) return { icon: isDay ? 'partly-sunny-outline' : 'moon-outline', label: 'Mostly clear' };
  if (code === 2) return { icon: isDay ? 'partly-sunny-outline' : 'cloudy-night-outline', label: 'Partly cloudy' };
  if (code === 3) return { icon: 'cloudy-outline', label: 'Cloudy' };
  if ([45, 48].includes(code)) return { icon: 'cloud-outline', label: 'Fog' };
  if ([51, 53, 55, 56, 57].includes(code)) return { icon: 'rainy-outline', label: 'Drizzle' };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { icon: 'rainy-outline', label: 'Rain' };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { icon: 'snow-outline', label: 'Snow' };
  if ([95, 96, 99].includes(code)) return { icon: 'thunderstorm-outline', label: 'Thunderstorm' };
  return { icon: 'thermometer-outline', label: 'Unknown' };
};

// Kort "snow conditions"-tekst ud fra tre rigtige tal fra Open-Meteo: snedybde
// i byen (vejrmodellens tal), dagens snefald og temperaturen. Det er stadig
// en tommelfingerregel og ikke en officiel pistrapport, men den påstår ikke
// længere "Good", når der slet ikke ligger sne.
export function snowConditionLabel({ snowDepthCm, snowfallTodayCm, temperature }) {
  if (snowfallTodayCm >= 10) return 'Fresh powder';
  if (snowfallTodayCm >= 2) return 'Fresh snow';
  if (snowDepthCm < 5) return 'Little or no snow in the village';
  if (temperature > 5) return 'Soft snow';
  return 'Packed snow';
}

// Open-Meteo sender fx 0.56 og 4.01 cm - vis højst én decimal, og ingen
// decimaler fra 10 cm og op.
export const formatCm = (cm) => (cm >= 10 ? Math.round(cm) : Math.round(cm * 10) / 10);

// "14:05" - hvornår vejret sidst blev hentet (telefonens egen tid).
export function formatUpdated(fetchedAt) {
  const d = new Date(fetchedAt);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const finite = (value) => (Number.isFinite(value) ? value : null);
const rounded = (value) => (Number.isFinite(value) ? Math.round(value) : null);

// `target` er enten ét punkt { latitude, longitude } (landsbyen) eller
// `model.weatherLevels`: [{ id, label, point, elevation }] i rækkefølgen
// landsby -> midt -> top. Landsbyen er altid den første.
export async function fetchWeather(target) {
  const levels = Array.isArray(target)
    ? target
    : [{ id: 'village', label: 'Village', point: target, elevation: null }];

  // Alle højder hentes i ÉT kald: Open-Meteo tager kommaseparerede lister og
  // svarer med en liste i samme rækkefølge. Stationens højde sendes med, så
  // temperaturen regnes om til den højde - ellers bruger Open-Meteo sin egen
  // højdemodel, som glatter toppe ud. Listerne skal være lige lange, så
  // mangler bare én højde, udelades de alle.
  const allElevationsKnown = levels.every((level) => Number.isFinite(level.elevation));
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${levels.map((level) => level.point.latitude).join(',')}` +
    `&longitude=${levels.map((level) => level.point.longitude).join(',')}` +
    (allElevationsKnown ? `&elevation=${levels.map((level) => level.elevation).join(',')}` : '') +
    `&current=temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m,snowfall,relative_humidity_2m,snow_depth,is_day,freezing_level_height` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,snowfall_sum,precipitation_probability_max` +
    `&timezone=auto&forecast_days=6`;

  // På en svag forbindelse på bjerget kan et kald hænge i minutter - giv op
  // efter 10 sekunder, så skærmen kan vise "prøv igen" i stedet for en
  // evig "loading".
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let body;
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error('Could not fetch weather data');
    body = await response.json();
  } finally {
    clearTimeout(timer);
  }

  // Ét punkt giver ét objekt, flere punkter en liste. `data` er landsbyen.
  const results = Array.isArray(body) ? body : [body];
  const data = results[0];

  // snow_depth kommer i meter; vi viser hele centimeter.
  const snowDepthCm = Math.round((data.current.snow_depth ?? 0) * 100);
  const snowfallTodayCm = data.daily.snowfall_sum[0] ?? 0;

  const current = {
    temperature: Math.round(data.current.temperature_2m),
    windSpeed: Math.round(data.current.wind_speed_10m),
    humidity: data.current.relative_humidity_2m,
    code: data.current.weather_code,
    isDay: data.current.is_day !== 0,
    snowDepthCm,
    snowfallTodayCm,
    snowConditions: snowConditionLabel({
      snowDepthCm,
      snowfallTodayCm,
      temperature: data.current.temperature_2m,
    }),
  };

  const daily = data.daily.time.map((date, i) => ({
    date,
    code: data.daily.weather_code[i],
    max: Math.round(data.daily.temperature_2m_max[i]),
    min: Math.round(data.daily.temperature_2m_min[i]),
    snowfallCm: data.daily.snowfall_sum[i],
    precipProbability: data.daily.precipitation_probability_max[i],
  }));

  // Vejret lige nu i hver højde. Mangler et tal i svaret, bliver det null
  // (ikke 0), så skærmen kan udelade det i stedet for at vise "0 km/h".
  const levelWeather = levels
    .map((level, i) => {
      const now = results[i]?.current;
      if (!now) return null;
      return {
        id: level.id,
        label: level.label,
        elevation: rounded(results[i].elevation) ?? finite(level.elevation),
        temperature: rounded(now.temperature_2m),
        windSpeed: rounded(now.wind_speed_10m),
        windGusts: rounded(now.wind_gusts_10m),
        snowDepthCm: Number.isFinite(now.snow_depth) ? Math.round(now.snow_depth * 100) : null,
        code: finite(now.weather_code),
        isDay: now.is_day !== 0,
      };
    })
    .filter(Boolean);

  // Frysepunktets højde tages fra landsbyen, det laveste punkt: højere oppe
  // ligger vejrmodellens terræn ofte OVER frysepunktet, og så svarer den med
  // terrænets højde i stedet (Verbier 25/11-2026: 1.720 m i landsbyen, men
  // 2.430 m for toppen, hvor der var -10°). Er der frost i alle højder, ligger
  // frysepunktet under landsbyen, og tallet siger ikke noget - så udelades det.
  const thawSomewhere = results.some((result) => result?.current?.temperature_2m > 0);
  const freezing = data.current.freezing_level_height;
  const freezingLevelM = thawSomewhere && freezing > 0 ? Math.round(freezing) : null;

  // `elevation` er højden på det punkt, vejrmodellen har regnet for.
  return {
    current,
    daily,
    elevation: Number.isFinite(data.elevation) ? Math.round(data.elevation) : null,
    levels: levelWeather,
    freezingLevelM,
    fetchedAt: Date.now(),
  };
}
