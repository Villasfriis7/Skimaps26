import React from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { weatherCodeMeta } from '../data/weather';
import { styles, colors } from '../styles/styles';

const dayNames = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'];

// Detaljeret vejrudsigt for Verbier - modtager allerede hentet vejrdata via
// route.params fra ExploreScreen (samme Open-Meteo-kald genbruges, så vi ikke
// henter data to gange).
export default function WeatherDetailScreen({ route }) {
  const { weather } = route.params;

  if (!weather) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const { current, daily } = weather;
  const currentMeta = weatherCodeMeta(current.code);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>
          {currentMeta.emoji} {current.temperature}°C
        </Text>
        <Text style={styles.heroSubtitle}>{currentMeta.label} · Verbier</Text>
        <View style={styles.weatherChip}>
          <Text style={styles.weatherChipText}>❄️ Snow conditions: {current.snowConditions}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statTile}>
          <Text style={styles.statNumber}>{current.windSpeed}</Text>
          <Text style={styles.statLabel}>km/h vind</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statNumber}>{current.humidity}%</Text>
          <Text style={styles.statLabel}>Luftfugtighed</Text>
        </View>
        <View style={[styles.statTile, { borderRightWidth: 0 }]}>
          <Text style={styles.statNumber}>{current.snowfall}</Text>
          <Text style={styles.statLabel}>cm sne nu</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>6-dages udsigt</Text>
      <View style={{ height: 12 }} />
      {daily.map((d, i) => {
        const meta = weatherCodeMeta(d.code);
        const date = new Date(d.date);
        const dayLabel = i === 0 ? 'I dag' : dayNames[date.getDay()];
        return (
          <View key={d.date} style={styles.listItem}>
            <View style={[styles.listItemIconWrap, { backgroundColor: colors.ice }]}>
              <Text style={{ fontSize: 24 }}>{meta.emoji}</Text>
            </View>
            <View style={styles.listItemTextWrap}>
              <Text style={styles.listItemTitle}>{dayLabel}</Text>
              <Text style={styles.listItemSubtitle}>
                {meta.label}
                {d.snowfallCm > 0 ? ` · ❄️ ${d.snowfallCm} cm` : ''}
              </Text>
            </View>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textDark }}>
              {d.max}° / {d.min}°
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}
