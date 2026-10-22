// Rigtig vejr-/snedata for Verbier via Open-Meteo (gratis, ingen API-nøgle,
// ikke-kommerciel brug - fint til dette skoleprojekt). Koordinaterne er
// Verbier bys egne, ikke brugerens telefon-placering.
const VERBIER_LAT = 46.0961;
const VERBIER_LON = 7.2286;

// WMO weather-koder (bruges af Open-Meteo) oversat til emoji + dansk tekst.
export const weatherCodeMeta = (code) => {
  if (code === 0) return { emoji: '☀️', label: 'Sunny' };
  if ([1, 2].includes(code)) return { emoji: '🌤️', label: 'Mostly sunny' };
  if (code === 3) return { emoji: '☁️', label: 'Cloudy' };
  if ([45, 48].includes(code)) return { emoji: '🌫️', label: 'Fog' };
  if ([51, 53, 55, 56, 57].includes(code)) return { emoji: '🌦️', label: 'Drizzle' };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { emoji: '🌧️', label: 'Rain' };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { emoji: '🌨️', label: 'Snow' };
  if ([95, 96, 99].includes(code)) return { emoji: '⛈️', label: 'Thunderstorm' };
  return { emoji: '🌡️', label: 'Unknown' };
};

// Simpel kvalitativ "snow conditions"-vurdering ud fra nylig snefald + temperatur.
function snowConditionLabel(recentSnowCm, tempC) {
  if (recentSnowCm >= 10) return 'Excellent - fresh powder';
  if (recentSnowCm >= 2) return 'Good - recent snowfall';
  if (tempC > 5) return 'Variable - soft snow';
  return 'Good';
}

export async function fetchVerbierWeather() {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${VERBIER_LAT}&longitude=${VERBIER_LON}` +
    `&current=temperature_2m,weather_code,wind_speed_10m,snowfall,relative_humidity_2m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,snowfall_sum,precipitation_probability_max` +
    `&timezone=auto&forecast_days=6`;

  const response = await fetch(url);
  if (!response.ok) throw new Error('Kunne ikke hente vejrdata');
  const data = await response.json();

  const current = {
    temperature: Math.round(data.current.temperature_2m),
    windSpeed: Math.round(data.current.wind_speed_10m),
    humidity: data.current.relative_humidity_2m,
    snowfall: data.current.snowfall,
    code: data.current.weather_code,
    snowConditions: snowConditionLabel(data.daily.snowfall_sum[0], data.current.temperature_2m),
  };

  const daily = data.daily.time.map((date, i) => ({
    date,
    code: data.daily.weather_code[i],
    max: Math.round(data.daily.temperature_2m_max[i]),
    min: Math.round(data.daily.temperature_2m_min[i]),
    snowfallCm: data.daily.snowfall_sum[i],
    precipProbability: data.daily.precipitation_probability_max[i],
  }));

  return { current, daily };
}
