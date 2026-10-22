import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { pois } from '../data/pois';
import { partners } from '../data/partners';
import { places } from '../data/places';
import { lifts } from '../data/verbierMap';
import { categoryMeta } from '../data/categoryMeta';
import { fetchVerbierWeather, weatherCodeMeta } from '../data/weather';
import { styles, colors } from '../styles/styles';

// Explore er appens startfane - overblik over skiområdet, rigtigt vejr
// (Open-Meteo), søgning og genveje til restauranter/partnere. Søgningen
// dækker både de kuraterede steder, de 363 rigtige OSM-steder og lifterne.
export default function ExploreScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState(false);

  useEffect(() => {
    fetchVerbierWeather()
      .then(setWeather)
      .catch(() => setWeatherError(true));
  }, []);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const poiMatches = pois
      .filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
      .map((p) => ({ kind: 'poi', id: p.id, title: p.name, subtitle: p.walkTime, data: p }));
    const placeMatches = places
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 15)
      .map((p) => ({
        kind: 'place',
        id: p.id,
        title: p.name,
        subtitle: categoryMeta[p.category]?.label,
        data: p,
      }));
    const liftMatches = lifts
      .filter((l) => l.name.toLowerCase().includes(q))
      .slice(0, 8)
      .map((l) => ({ kind: 'lift', id: l.id, title: l.name, subtitle: 'Lift', data: l }));
    return [...poiMatches, ...placeMatches, ...liftMatches];
  }, [query]);

  const comingSoon = (feature) => Alert.alert(feature, 'Kommer i en senere version.');

  const currentMeta = weather ? weatherCodeMeta(weather.current.code) : null;

  return (
    <SafeAreaView style={styles.exploreScroll} edges={['top']}>
    <ScrollView contentContainerStyle={styles.exploreScrollContent}>
      <View style={styles.exploreTopBar}>
        <View style={styles.exploreBrandRow}>
          <Ionicons name="snow" size={24} color={colors.primary} />
          <Text style={styles.exploreBrandText}>SkiMaps</Text>
        </View>
        <Ionicons name="search-outline" size={22} color={colors.primary} />
      </View>

      <TouchableOpacity
        style={styles.heroCard}
        disabled={!weather}
        onPress={() => navigation.navigate('WeatherDetail', { weather })}
      >
        <Text style={styles.heroTitle}>Verbier 🇨🇭</Text>
        <Text style={styles.heroSubtitle}>Switzerland</Text>
        {weather ? (
          <View style={styles.weatherChip}>
            <Text style={{ fontSize: 16 }}>{currentMeta.emoji}</Text>
            <Text style={styles.weatherChipText}>
              {weather.current.temperature}°C · {currentMeta.label} · Snow: {weather.current.snowConditions}
            </Text>
          </View>
        ) : weatherError ? (
          <View style={styles.weatherChip}>
            <Text style={styles.weatherChipText}>Kunne ikke hente vejret lige nu</Text>
          </View>
        ) : (
          <View style={styles.weatherChip}>
            <ActivityIndicator size="small" color={colors.white} />
            <Text style={styles.weatherChipText}>Henter rigtigt vejr...</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={{ flex: 1, marginLeft: 8, fontSize: 15, color: colors.textDark }}
          placeholder="Search restaurants, lifts, activities..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {searchResults ? (
        <View>
          <Text style={styles.sectionTitle}>Resultater</Text>
          <View style={{ height: 12 }} />
          {searchResults.length === 0 && (
            <Text style={{ color: colors.textMuted }}>Ingen resultater for "{query}"</Text>
          )}
          {searchResults.map((r) => (
            <TouchableOpacity
              key={`${r.kind}-${r.id}`}
              style={styles.listItem}
              onPress={() =>
                r.kind === 'lift'
                  ? navigation.navigate('Map')
                  : navigation.navigate('POIDetail', { poi: r.data })
              }
            >
              <View style={[styles.listItemIconWrap, { backgroundColor: colors.ice }]}>
                <Ionicons
                  name={
                    r.kind === 'lift'
                      ? 'triangle-outline'
                      : categoryMeta[r.data.category || r.data.type]?.icon || 'pin-outline'
                  }
                  size={22}
                  color={colors.primary}
                />
              </View>
              <View style={styles.listItemTextWrap}>
                <Text style={styles.listItemTitle}>{r.title}</Text>
                <Text style={styles.listItemSubtitle}>{r.subtitle}</Text>
              </View>
              <Text style={styles.listItemChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => navigation.navigate('Map', { focusCategory: 'restaurant' })}
            >
              <View style={styles.quickActionIconWrap}>
                <Ionicons name="restaurant-outline" size={24} color={colors.primary} />
              </View>
              <Text style={styles.quickActionLabel}>Restaurants</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => navigation.navigate('Map', { focusCategory: 'apres_ski' })}
            >
              <View style={styles.quickActionIconWrap}>
                <Ionicons name="wine-outline" size={24} color={colors.primary} />
              </View>
              <Text style={styles.quickActionLabel}>Après-ski</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionItem} onPress={() => navigation.navigate('Map')}>
              <View style={styles.quickActionIconWrap}>
                <Ionicons name="triangle-outline" size={24} color={colors.primary} />
              </View>
              <Text style={styles.quickActionLabel}>Lift stations</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionItem} onPress={() => comingSoon('Activities')}>
              <View style={styles.quickActionIconWrap}>
                <Ionicons name="bicycle-outline" size={24} color={colors.primary} />
              </View>
              <Text style={styles.quickActionLabel}>Activities</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Featured in Verbier</Text>
            <Text style={styles.sectionSeeAll}>See all</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.horizontalScroll}
            contentContainerStyle={{ alignItems: 'flex-start' }}
          >
            {pois.map((poi) => (
              <TouchableOpacity
                key={poi.id}
                style={styles.featuredCard}
                onPress={() => navigation.navigate('POIDetail', { poi })}
              >
                <View
                  style={[
                    styles.featuredCardImage,
                    { backgroundColor: poi.type === 'cafe' ? '#fdeed7' : '#fbe0d7' },
                  ]}
                >
                  <Text style={styles.featuredCardEmoji}>{poi.type === 'cafe' ? '☕' : '🍽️'}</Text>
                </View>
                <Text style={styles.featuredCardTitle}>{poi.name}</Text>
                <Text style={styles.featuredCardSubtitle}>{poi.walkTime}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Popular partners in Verbier</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Partners')}>
              <Text style={styles.sectionSeeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.horizontalScroll}
            contentContainerStyle={{ alignItems: 'flex-start' }}
          >
            {partners.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.partnerMiniCard}
                onPress={() => navigation.navigate('Partners')}
              >
                <View style={styles.partnerMiniDiscount}>
                  <Text style={styles.partnerMiniDiscountText}>{p.discount}</Text>
                </View>
                <Text style={styles.partnerMiniTitle}>{p.name}</Text>
                <Text style={styles.partnerMiniSubtitle}>{p.categoryLabel}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}
    </ScrollView>
    </SafeAreaView>
  );
}
