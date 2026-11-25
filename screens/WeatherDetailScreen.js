import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { weatherCodeMeta, formatCm, formatUpdated } from '../data/weather';
import { useResort } from '../context/ResortContext';
import { openLink } from '../utils/links';
import { styles, colors } from '../styles/styles';

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Open-Meteo sender datoer som "2026-11-24". new Date("2026-11-24") læser den
// som midnat UTC, hvilket bliver dagen FØR i tidszoner vest for Greenwich -
// derfor bygger vi datoen af tallene i stedet.
function weekdayOf(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return dayNames[new Date(year, month - 1, day).getDay()];
}

// Detaljeret vejrudsigt for skiområdet: landsbyen øverst, vejret oppe på
// bjerget lige nu og seks dage frem. Modtager allerede hentet vejrdata via
// route.params fra ExploreScreen (samme Open-Meteo-kald genbruges, så vi ikke
// henter data to gange).
export default function WeatherDetailScreen({ route }) {
  const { weather } = route.params;
  const { resort } = useResort();

  if (!weather) {
    return (
      <View style={styles.centered}>
        <StatusBar style="dark" />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const { current, daily } = weather;
  const currentMeta = weatherCodeMeta(current.code, current.isDay);

  // Vejret i højden, toppen først - det er dér, skiløberne spørger til vind
  // og sne. Er der kun landsbyen (fladt område, eller vejrdata hentet før
  // højderne kom med), vises afsnittet slet ikke: tallene står allerede ovenfor.
  const mountain = (weather.levels || []).length > 1 ? [...weather.levels].reverse() : [];
  const hasFreezingLevel = mountain.length > 0 && weather.freezingLevelM != null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
      <StatusBar style="dark" />

      <View style={styles.weatherHero}>
        <View style={styles.weatherHeroRow}>
          <Ionicons name={currentMeta.icon} size={52} color={colors.white} />
          <Text style={styles.weatherTemp}>{current.temperature}°</Text>
        </View>
        <Text style={[styles.heroSubtitle, { fontSize: 15, marginTop: 4 }]}>
          {currentMeta.label} · {current.snowConditions}
        </Text>
        <Text style={styles.heroSubtitle}>
          {resort.name} village{weather.elevation ? ` (${weather.elevation.toLocaleString('en-US')} m)` : ''} ·
          updated {formatUpdated(weather.fetchedAt)}
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statTile}>
          <Text style={styles.statNumber}>{current.snowDepthCm} cm</Text>
          <Text style={styles.statLabel}>Snow in the village</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statNumber}>{formatCm(current.snowfallTodayCm)} cm</Text>
          <Text style={styles.statLabel}>Snowfall today</Text>
        </View>
        <View style={[styles.statTile, { borderRightWidth: 0 }]}>
          <Text style={styles.statNumber}>{current.windSpeed} km/h</Text>
          <Text style={styles.statLabel}>Wind</Text>
        </View>
      </View>

      <Text style={[styles.footnote, { marginTop: -12, marginBottom: 20 }]}>
        These are the weather model's figures for the village, not a measured piste report.{' '}
        {mountain.length > 0
          ? "The same model's figures for higher up are below."
          : 'There is usually more snow and more wind higher up.'}
      </Text>

      {mountain.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { marginBottom: 12 }]} accessibilityRole="header">
            On the mountain now
          </Text>
          {/* Luften ned til næste afsnit (20) ligger på det sidste element. */}
          <View style={[styles.group, !hasFreezingLevel && { marginBottom: 20 }]}>
            {mountain.map((level, i) => {
              const meta = weatherCodeMeta(level.code, level.isDay);
              const wind =
                level.windSpeed != null
                  ? `Wind ${level.windSpeed} km/h${level.windGusts != null ? `, gusts ${level.windGusts} km/h` : ''}`
                  : level.windGusts != null
                    ? `Gusts ${level.windGusts} km/h`
                    : null;
              const snow = level.snowDepthCm != null ? `${level.snowDepthCm} cm snow` : null;
              const details = [wind, snow].filter(Boolean).join(' · ');
              return (
                <React.Fragment key={level.id}>
                  {i > 0 ? <View style={styles.rowDivider} /> : null}
                  <View style={styles.row}>
                    <View style={styles.rowTile}>
                      <Ionicons name={meta.icon} size={22} color={colors.primary} />
                    </View>
                    <View style={styles.rowTextWrap}>
                      <Text style={styles.rowTitle}>
                        {level.label}
                        {level.elevation != null ? ` · ${level.elevation.toLocaleString('en-US')} m` : ''}
                      </Text>
                      {details ? <Text style={styles.rowSubtitle}>{details}</Text> : null}
                    </View>
                    {level.temperature != null ? (
                      <Text
                        style={[styles.forecastHigh, { marginLeft: 8 }]}
                        accessibilityLabel={`${level.temperature} degrees`}
                      >
                        {level.temperature}°
                      </Text>
                    ) : null}
                  </View>
                </React.Fragment>
              );
            })}
          </View>
          {hasFreezingLevel ? (
            <Text style={[styles.footnote, { marginTop: -4, marginBottom: 20 }]}>
              Freezing level about {(Math.round(weather.freezingLevelM / 100) * 100).toLocaleString('en-US')} m.
            </Text>
          ) : null}
        </>
      ) : null}

      <Text style={[styles.sectionTitle, { marginBottom: 12 }]} accessibilityRole="header">
        6-day forecast
      </Text>
      <View style={styles.group}>
        {daily.map((d, i) => {
          const meta = weatherCodeMeta(d.code);
          const details = [meta.label];
          if (d.snowfallCm > 0) details.push(`${formatCm(d.snowfallCm)} cm snow`);
          // Står der allerede "Snow" eller "Rain", er "88% chance" nok.
          const wet = ['Snow', 'Rain', 'Drizzle', 'Thunderstorm'].includes(meta.label);
          if (d.precipProbability != null && (wet || d.precipProbability > 0)) {
            details.push(`${d.precipProbability}% chance${wet ? '' : ' of snow or rain'}`);
          }
          return (
            <React.Fragment key={d.date}>
              {i > 0 ? <View style={styles.rowDivider} /> : null}
              <View style={styles.row}>
                <View style={styles.rowTile}>
                  <Ionicons name={meta.icon} size={22} color={colors.primary} />
                </View>
                <View style={styles.rowTextWrap}>
                  <Text style={styles.rowTitle}>{i === 0 ? 'Today' : weekdayOf(d.date)}</Text>
                  <Text style={styles.rowSubtitle}>{details.join(' · ')}</Text>
                </View>
                <Text
                  style={styles.forecastHigh}
                  accessibilityLabel={`High ${d.max} degrees, low ${d.min} degrees`}
                >
                  {d.max}° <Text style={styles.forecastLow}>{d.min}°</Text>
                </Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>
      <Text style={styles.footnote}>Each day shows the high and the low temperature.</Text>

      {/* Open-Meteo kræver kildeangivelse (CC BY 4.0) */}
      <TouchableOpacity onPress={() => openLink('https://open-meteo.com/')} accessibilityRole="link">
        <Text style={[styles.footnote, styles.footnoteLink]}>Weather data by Open-Meteo.com</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
