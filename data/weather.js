// Rigtig vejr-/snedata for Verbier via Open-Meteo (gratis, ingen API-nøgle,
// ikke-kommerciel brug - fint til dette skoleprojekt). Koordinaterne er
// Verbier bys egne (ca. 1.500 m), ikke brugerens telefon-placering. Open-Meteo
// kræver kildeangivelse (CC BY 4.0) - den vises på WeatherDetailScreen.
const VERBIER_LAT = 46.0961;
const VERBIER_LON = 7.2286;

// WMO weather-koder (bruges af Open-Meteo) oversat til emoji + tekst.
// `isDay` bruges kun til at vælge måne i stedet for sol om natten.
export const weatherCodeMeta = (code, isDay = true) => {
  if (code === 0) return isDay ? { emoji: '☀️', label: 'Sunny' } : { emoji: '🌙', label: 'Clear' };
  if (code === 1) return { emoji: isDay ? '🌤️' : '🌙', label: 'Mostly clear' };
  if (code === 2) return { emoji: isDay ? '⛅' : '☁️', label: 'Partly cloudy' };
  if (code === 3) return { emoji: '☁️', label: 'Cloudy' };
  if ([45, 48].includes(code)) return { emoji: '🌫️', label: 'Fog' };
  if ([51, 53, 55, 56, 57].includes(code)) return { emoji: '🌦️', label: 'Drizzle' };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { emoji: '🌧️', label: 'Rain' };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { emoji: '🌨️', label: 'Snow' };
  if ([95, 96, 99].includes(code)) return { emoji: '⛈️', label: 'Thunderstorm' };
  return { emoji: '🌡️', label: 'Unknown' };
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

export async function fetchVerbierWeather() {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${VERBIER_LAT}&longitude=${VERBIER_LON}` +
    `&current=temperature_2m,weather_code,wind_speed_10m,snowfall,relative_humidity_2m,snow_depth,is_day` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,snowfall_sum,precipitation_probability_max` +
    `&timezone=auto&forecast_days=6`;

  const response = await fetch(url);
  if (!response.ok) throw new Error('Could not fetch weather data');
  const data = await response.json();

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
