import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { weatherCodeMeta } from '../data/weather';
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

// Detaljeret vejrudsigt for Verbier - modtager allerede hentet vejrdata via
// route.params fra ExploreScreen (samme Open-Meteo-kald genbruges, så vi ikke
// henter data to gange).
export default function WeatherDetailScreen({ route }) {
  const { weather } = route.params;

  if (!weather) {
    return (
      <View style={styles.centeredContainer}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const { current, daily } = weather;
  const currentMeta = weatherCodeMeta(current.code, current.isDay);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <StatusBar style="light" />
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>
          {currentMeta.emoji} {current.temperature}°C
        </Text>
        <Text style={styles.heroSubtitle}>{currentMeta.label} · Verbier village (1,500 m)</Text>
        <View style={styles.weatherChip}>
          <Text style={styles.weatherChipText}>❄️ {current.snowConditions}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statTile}>
          <Text style={styles.statNumber}>{current.snowDepthCm} cm</Text>
          <Text style={styles.statLabel}>Snow depth</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statNumber}>{current.snowfallTodayCm} cm</Text>
          <Text style={styles.statLabel}>Snowfall today</Text>
        </View>
        <View style={[styles.statTile, { borderRightWidth: 0 }]}>
          <Text style={styles.statNumber}>{current.windSpeed} km/h</Text>
          <Text style={styles.statLabel}>Wind</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>6-day forecast</Text>
      <View style={{ height: 12 }} />
      {daily.map((d, i) => {
        const meta = weatherCodeMeta(d.code);
        const details = [meta.label];
        if (d.snowfallCm > 0) details.push(`❄️ ${d.snowfallCm} cm`);
        if (d.precipProbability != null) details.push(`💧 ${d.precipProbability}%`);
        return (
          <View key={d.date} style={styles.listItem}>
            <View style={[styles.listItemIconWrap, { backgroundColor: colors.ice }]}>
              <Text style={{ fontSize: 24 }}>{meta.emoji}</Text>
            </View>
            <View style={styles.listItemTextWrap}>
              <Text style={styles.listItemTitle}>{i === 0 ? 'Today' : weekdayOf(d.date)}</Text>
              <Text style={styles.listItemSubtitle}>{details.join(' · ')}</Text>
            </View>
            <Text style={styles.forecastTemps}>
              {d.max}° / {d.min}°
            </Text>
          </View>
        );
      })}

      <Text style={styles.footnote}>
        Snow depth is the weather model's figure for the village, not a measured piste report - there
        is usually more snow higher up.
      </Text>
      {/* Open-Meteo kræver kildeangivelse (CC BY 4.0) */}
      <TouchableOpacity onPress={() => openLink('https://open-meteo.com/')}>
        <Text style={[styles.footnote, styles.footnoteLink]}>Weather data by Open-Meteo.com</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
