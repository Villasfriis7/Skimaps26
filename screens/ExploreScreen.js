import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { pois } from '../data/pois';
import { partners } from '../data/partners';
import { lifts } from '../data/verbierMap';
import { categoryMeta } from '../data/categoryMeta';
import { fetchVerbierWeather, weatherCodeMeta } from '../data/weather';
import { allPlaces, placeCategory, nearestLiftStation } from '../utils/places';
import { liftTypeLabels } from '../utils/pistes';
import { formatDistance } from '../utils/geo';
import { styles, colors } from '../styles/styles';

// Vejret hentes igen, når man vender tilbage til fanen, men højst hvert 10.
// minut - Open-Meteo opdaterer ikke oftere, og vi vil ikke spamme API'et.
const WEATHER_MAX_AGE_MS = 10 * 60 * 1000;

const MAX_PLACE_RESULTS = 15;
const MAX_LIFT_RESULTS = 8;

// "350 m from Médran 2" - beregnet, ikke skrevet i hånden.
function nearLiftText(place) {
  const nearest = nearestLiftStation(place);
  return nearest ? `${formatDistance(nearest.meters)} from ${nearest.lift.name}` : '';
}

// Explore er appens startfane - overblik over skiområdet, rigtigt vejr
// (Open-Meteo), søgning og genveje til kortet/partnere. Søgningen dækker
// alle steder (kuraterede + OSM) og lifterne.
export default function ExploreScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState(false);
  const searchInput = useRef(null);
  const loadingWeather = useRef(false);

  const loadWeather = useCallback(() => {
    if (loadingWeather.current) return;
    loadingWeather.current = true;
    setWeatherError(false);
    fetchVerbierWeather()
      .then(setWeather)
      .catch(() => setWeatherError(true))
      .finally(() => {
        loadingWeather.current = false;
      });
  }, []);

  // Kører hver gang Explore-fanen får fokus (også første gang).
  useFocusEffect(
    useCallback(() => {
      const fresh = weather && Date.now() - weather.fetchedAt < WEATHER_MAX_AGE_MS;
      if (!fresh) loadWeather();
    }, [weather, loadWeather])
  );

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    // Rangér træfferne, så det, brugeren mest sandsynligt mener, står øverst:
    // navn der starter med søgningen > et ord i navnet der starter med den >
    // navn der indeholder den > kun nævnt i beskrivelsen.
    const rank = (p) => {
      const name = p.name.toLowerCase();
      if (name.startsWith(q)) return 0;
      if (name.split(/[\s\-|,]+/).some((word) => word.startsWith(q))) return 1;
      if (name.includes(q)) return 2;
      if ((p.description || '').toLowerCase().includes(q)) return 3;
      return -1;
    };
    const placeMatches = allPlaces
      .map((p) => ({ place: p, rank: rank(p) }))
      .filter((match) => match.rank !== -1)
      .sort((a, b) => a.rank - b.rank || a.place.name.localeCompare(b.place.name))
      .slice(0, MAX_PLACE_RESULTS)
      .map(({ place: p }) => ({
        kind: 'place',
        id: p.id,
        title: p.name,
        subtitle: `${categoryMeta[placeCategory(p)]?.singular} · ${nearLiftText(p)}`,
        data: p,
      }));
    const liftMatches = lifts
      .filter((l) => l.name.toLowerCase().includes(q))
      .slice(0, MAX_LIFT_RESULTS)
      .map((l) => ({
        kind: 'lift',
        id: l.id,
        title: l.name,
        subtitle: `${liftTypeLabels[l.liftType] || liftTypeLabels.unknown} · show on map`,
        data: l,
      }));
    return [...placeMatches, ...liftMatches];
  }, [query]);

  const comingSoon = (feature) => Alert.alert(feature, 'Coming in a later version.');

  // focusKey er ny ved hvert tryk, så kortet reagerer, selvom man vælger den
  // samme genvej to gange i træk.
  const openMap = (params) => navigation.navigate('Map', { ...params, focusKey: Date.now() });

  const currentMeta = weather ? weatherCodeMeta(weather.current.code, weather.current.isDay) : null;

  return (
    <SafeAreaView style={styles.exploreScroll} edges={['top']}>
      {/* "handled": et tryk på et søgeresultat virker med det samme, selvom
          tastaturet er åbent (ellers lukker første tryk kun tastaturet). */}
      <ScrollView
        contentContainerStyle={styles.exploreScrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.exploreTopBar}>
          <View style={styles.exploreBrandRow}>
            <Ionicons name="snow" size={24} color={colors.primary} />
            <Text style={styles.exploreBrandText}>SkiMaps</Text>
          </View>
          <TouchableOpacity
            onPress={() => searchInput.current?.focus()}
            hitSlop={10}
            accessibilityLabel="Search"
          >
            <Ionicons name="search-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Mens man søger, skjules vejr-kortet, så resultaterne får pladsen. */}
        {!searchResults && (
        <TouchableOpacity
          style={styles.heroCard}
          disabled={!weather && !weatherError}
          onPress={() =>
            weather ? navigation.navigate('WeatherDetail', { weather }) : loadWeather()
          }
        >
          <Text style={styles.heroTitle}>Verbier 🇨🇭</Text>
          <Text style={styles.heroSubtitle}>Switzerland</Text>
          {weather ? (
            <View style={styles.weatherChip}>
              <Text style={{ fontSize: 16 }}>{currentMeta.emoji}</Text>
              <Text style={styles.weatherChipText}>
                {weather.current.temperature}°C · {currentMeta.label} · {weather.current.snowConditions}
              </Text>
            </View>
          ) : weatherError ? (
            <View style={styles.weatherChip}>
              <Ionicons name="refresh" size={14} color={colors.white} />
              <Text style={styles.weatherChipText}>Could not load the weather · tap to retry</Text>
            </View>
          ) : (
            <View style={styles.weatherChip}>
              <ActivityIndicator size="small" color={colors.white} />
              <Text style={styles.weatherChipText}>Loading live weather...</Text>
            </View>
          )}
        </TouchableOpacity>
        )}

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            ref={searchInput}
            style={styles.searchInput}
            placeholder="Search restaurants, hotels, lifts..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {searchResults ? (
          <View>
            <Text style={styles.sectionTitle}>Results</Text>
            <View style={{ height: 12 }} />
            {searchResults.length === 0 && (
              <Text style={styles.mutedText}>No results for "{query.trim()}"</Text>
            )}
            {searchResults.map((r) => (
              <TouchableOpacity
                key={`${r.kind}-${r.id}`}
                style={styles.listItem}
                onPress={() =>
                  r.kind === 'lift'
                    ? openMap({ focusLiftId: r.id })
                    : navigation.navigate('POIDetail', { poi: r.data })
                }
              >
                <View style={[styles.listItemIconWrap, { backgroundColor: colors.ice }]}>
                  <Ionicons
                    name={
                      r.kind === 'lift'
                        ? 'triangle-outline'
                        : categoryMeta[placeCategory(r.data)]?.icon || 'pin-outline'
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
                onPress={() => openMap({ focusCategory: 'restaurant' })}
              >
                <View style={styles.quickActionIconWrap}>
                  <Ionicons name="restaurant-outline" size={24} color={colors.primary} />
                </View>
                <Text style={styles.quickActionLabel}>Restaurants</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => openMap({ focusCategory: 'apres_ski' })}
              >
                <View style={styles.quickActionIconWrap}>
                  <Ionicons name="wine-outline" size={24} color={colors.primary} />
                </View>
                <Text style={styles.quickActionLabel}>Après-ski</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => openMap({ focusCategory: 'lifts' })}
              >
                <View style={styles.quickActionIconWrap}>
                  <Ionicons name="triangle-outline" size={24} color={colors.primary} />
                </View>
                <Text style={styles.quickActionLabel}>Lifts & pistes</Text>
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
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalScroll}
              contentContainerStyle={styles.horizontalScrollContent}
            >
              {pois.map((poi) => {
                const meta = categoryMeta[poi.category];
                return (
                  <TouchableOpacity
                    key={poi.id}
                    style={styles.featuredCard}
                    onPress={() => navigation.navigate('POIDetail', { poi })}
                  >
                    <View style={[styles.featuredCardImage, { backgroundColor: meta.bg }]}>
                      <Text style={styles.featuredCardEmoji}>{poi.emoji || meta.emoji}</Text>
                    </View>
                    <Text style={styles.featuredCardTitle} numberOfLines={1}>
                      {poi.name}
                    </Text>
                    <Text style={styles.featuredCardSubtitle} numberOfLines={2}>
                      {nearLiftText(poi)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Popular partners in Verbier</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Partners')} hitSlop={10}>
                <Text style={styles.sectionSeeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalScroll}
              contentContainerStyle={styles.horizontalScrollContent}
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
