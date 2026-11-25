// Rigtig vejr-/snedata for Verbier via Open-Meteo (gratis, ingen API-nøgle,
// ikke-kommerciel brug - fint til dette skoleprojekt). Koordinaterne er
// Verbier bys egne (ca. 1.500 m), ikke brugerens telefon-placering. Open-Meteo
// kræver kildeangivelse (CC BY 4.0) - den vises på WeatherDetailScreen.
const VERBIER_LAT = 46.0961;
const VERBIER_LON = 7.2286;
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

export async function fetchVerbierWeather() {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${VERBIER_LAT}&longitude=${VERBIER_LON}` +
    `&current=temperature_2m,weather_code,wind_speed_10m,snowfall,relative_humidity_2m,snow_depth,is_day` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,snowfall_sum,precipitation_probability_max` +
    `&timezone=auto&forecast_days=6`;

  // På en svag forbindelse på bjerget kan et kald hænge i minutter - giv op
  // efter 10 sekunder, så skærmen kan vise "prøv igen" i stedet for en
  // evig "loading".
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let data;
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error('Could not fetch weather data');
    data = await response.json();
  } finally {
    clearTimeout(timer);
  }

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

  return { current, daily, fetchedAt: Date.now() };
}
