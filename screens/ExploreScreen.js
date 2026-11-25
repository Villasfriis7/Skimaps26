import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  AppState,
  Keyboard,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { categoryMeta } from '../data/categoryMeta';
import { fetchWeather, weatherCodeMeta } from '../data/weather';
import { useSavedPlaces } from '../context/SavedPlacesContext';
import { useResort } from '../context/ResortContext';
import { placeCategory } from '../utils/places';
import { search } from '../utils/search';
import { formatDistance } from '../utils/geo';
import { styles, colors } from '../styles/styles';

// Vejret hentes igen, når man vender tilbage til fanen eller appen, men
// højst hvert 10. minut - Open-Meteo opdaterer ikke oftere, og vi vil ikke
// spamme API'et.
const WEATHER_MAX_AGE_MS = 10 * 60 * 1000;

const resultIcon = (result) =>
  result.kind === 'lift'
    ? 'triangle-outline'
    : result.kind === 'piste'
      ? 'trending-down-outline'
      : categoryMeta[placeCategory(result.data)]?.icon || 'location-outline';

const categoryLabel = {
  restaurant: 'restaurants',
  cafe: 'cafés',
  apres_ski: 'après-ski places',
  hotel: 'hotels',
  ski_rental: 'ski rentals',
  toilets: 'public toilets',
  lifts: 'lifts',
};

// Explore er appens startfane - overblik over det valgte skiområde, rigtigt
// vejr (Open-Meteo), søgning og genveje. Søgningen dækker steder, lifter og
// pister (utils/search.js). Øverst skifter man skiområde.
export default function ExploreScreen({ navigation }) {
  const { resort, model } = useResort();
  const [query, setQuery] = useState('');
  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const searchInput = useRef(null);
  const loadingWeather = useRef(false);
  const { savedPlaces, isSaved } = useSavedPlaces();

  const loadWeather = useCallback(() => {
    if (loadingWeather.current) return Promise.resolve();
    loadingWeather.current = true;
    setWeatherError(false);
    return fetchWeather(model.weatherPoint)
      .then(setWeather)
      .catch(() => setWeatherError(true))
      .finally(() => {
        loadingWeather.current = false;
      });
  }, [model]);

  const refreshIfStale = useCallback(() => {
    const fresh = weather && Date.now() - weather.fetchedAt < WEATHER_MAX_AGE_MS;
    if (!fresh) loadWeather();
  }, [weather, loadWeather]);

  // Kører hver gang Explore-fanen får fokus (også første gang) ...
  useFocusEffect(refreshIfStale);

  // ... og når appen kommer frem igen efter at have ligget i baggrunden, så
  // man ikke ser gårsdagens vejr næste morgen.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshIfStale();
    });
    return () => sub.remove();
  }, [refreshIfStale]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWeather();
    setRefreshing(false);
  };

  const found = useMemo(() => search(model, query), [model, query]);

  // "350 m from Médran 2 lift" - beregnet, ikke skrevet i hånden.
  const nearLiftText = (place) => {
    const nearest = model.nearestLiftStation(place);
    return nearest ? `${formatDistance(nearest.meters)} from ${nearest.lift.name} lift` : '';
  };

  // focusKey er ny ved hvert tryk, så kortet reagerer, selvom man vælger den
  // samme genvej to gange i træk.
  const openMap = (params) => navigation.navigate('Map', { ...params, focusKey: Date.now() });

  const openResult = (result) => {
    Keyboard.dismiss();
    if (result.kind === 'lift') openMap({ focusLiftId: result.id });
    else if (result.kind === 'piste') openMap({ focusPisteId: result.id });
    else navigation.navigate('POIDetail', { poi: result.data });
  };

  const openCategory = (category) => {
    Keyboard.dismiss();
    if (category === 'toilets' || category === 'lifts') openMap({ focusCategory: category });
    else navigation.navigate('Places', { category });
  };

  const currentMeta = weather ? weatherCodeMeta(weather.current.code, weather.current.isDay) : null;

  const tiles = [
    { label: 'Restaurants', icon: 'restaurant-outline', onPress: () => openCategory('restaurant') },
    { label: 'Après-ski', icon: 'wine-outline', onPress: () => openCategory('apres_ski') },
    // Ikke alle skiområder har toiletter i OpenStreetMap.
    model.toilets.length > 0
      ? { label: 'Toilets', icon: 'water-outline', onPress: () => openCategory('toilets') }
      : { label: 'Hotels', icon: 'bed-outline', onPress: () => openCategory('hotel') },
    model.sledRun
      ? { label: 'Sled run', icon: 'trending-down-outline', onPress: () => openMap({ focusPisteId: model.sledRun.id }) }
      : { label: 'Cafés', icon: 'cafe-outline', onPress: () => openCategory('cafe') },
  ];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* "handled": et tryk på et søgeresultat virker med det samme, selvom
          tastaturet er åbent. Trækker man i listen, lukker tastaturet. */}
      <ScrollView
        contentContainerStyle={styles.exploreContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.brandRow}>
          <Ionicons name="snow" size={24} color={colors.primary} />
          <Text style={styles.brandText}>SkiMaps</Text>
        </View>

        {/* Mens man søger, skjules vejr-kortet, så resultaterne får pladsen. */}
        {!found && (
          <View style={styles.hero}>
            {/* Navnet er en knap: her skifter man skiområde. */}
            <TouchableOpacity
              style={styles.heroTitleRow}
              onPress={() => navigation.navigate('Resorts')}
              accessibilityRole="button"
              accessibilityLabel={`${resort.name}. Change resort`}
            >
              <Text style={styles.heroTitle} numberOfLines={2}>
                {resort.name}
              </Text>
              <View style={styles.heroChange}>
                <Ionicons name="swap-horizontal" size={16} color={colors.white} />
                <Text style={styles.heroChangeText} maxFontSizeMultiplier={1.3}>
                  Change
                </Text>
              </View>
            </TouchableOpacity>
            <Text style={styles.heroSubtitle}>
              {resort.country ? `${resort.country} · ` : ''}
              {model.lifts.length} lifts · {model.pisteKm} km of pistes · {model.allPlaces.length} places
            </Text>
            <TouchableOpacity
              style={styles.heroWeather}
              disabled={!weather && !weatherError}
              onPress={() =>
                weather ? navigation.navigate('WeatherDetail', { weather }) : loadWeather()
              }
              accessibilityRole="button"
              accessibilityLabel={weather ? 'Open the weather forecast' : 'Load the weather again'}
            >
              {weather ? (
                <>
                  <Ionicons name={currentMeta.icon} size={22} color={colors.white} />
                  <Text style={styles.heroWeatherText}>
                    {weather.current.temperature}°C · {currentMeta.label} · {weather.current.snowConditions}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.white} />
                </>
              ) : weatherError ? (
                <>
                  <Ionicons name="refresh" size={20} color={colors.white} />
                  <Text style={styles.heroWeatherText}>Could not load the weather · tap to retry</Text>
                </>
              ) : (
                <>
                  <ActivityIndicator size="small" color={colors.white} />
                  <Text style={styles.heroWeatherText}>Loading live weather...</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={colors.textMuted} />
          <TextInput
            ref={searchInput}
            style={styles.searchInput}
            placeholder="Search places, lifts and pistes"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search places, lifts and pistes"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery('')}
              style={styles.searchClear}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {found ? (
          <View>
            {found.total === 0 && !found.category ? (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={40} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>Nothing called "{query.trim()}"</Text>
                <Text style={styles.emptyText}>
                  SkiMaps knows the restaurants, cafés, bars, hotels, ski rentals, lifts and pistes
                  around {resort.name}. Try a name or a word like "pizza" or "hotel".
                </Text>
              </View>
            ) : (
              <View style={styles.group}>
                {found.category ? (
                  <>
                    <TouchableOpacity
                      style={styles.row}
                      onPress={() => openCategory(found.category)}
                      accessibilityRole="button"
                    >
                      <View style={[styles.rowTile, { backgroundColor: colors.primary }]}>
                        <Ionicons
                          name={found.category === 'toilets' || found.category === 'lifts' ? 'map-outline' : 'list'}
                          size={20}
                          color={colors.white}
                        />
                      </View>
                      <View style={styles.rowTextWrap}>
                        <Text style={styles.rowTitle}>Show all {categoryLabel[found.category]}</Text>
                        <Text style={styles.rowSubtitle}>
                          {found.category === 'toilets' || found.category === 'lifts'
                            ? 'On the map'
                            : 'Nearest first'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={styles.rowChevron} />
                    </TouchableOpacity>
                    {found.results.length > 0 ? <View style={styles.rowDivider} /> : null}
                  </>
                ) : null}
                {found.results.map((result, index) => (
                  <React.Fragment key={`${result.kind}-${result.id}`}>
                    {index > 0 ? <View style={styles.rowDivider} /> : null}
                    <TouchableOpacity
                      style={styles.row}
                      onPress={() => openResult(result)}
                      accessibilityRole="button"
                    >
                      <View style={styles.rowTile}>
                        <Ionicons name={resultIcon(result)} size={20} color={colors.primary} />
                      </View>
                      <View style={styles.rowTextWrap}>
                        <Text style={styles.rowTitle}>{result.title}</Text>
                        <Text style={styles.rowSubtitle}>{result.subtitle}</Text>
                      </View>
                      {/* Gemte steder er markeret med et hjerte. */}
                      {result.kind === 'place' && isSaved(result.id) ? (
                        <Ionicons name="heart" size={18} color={colors.saved} />
                      ) : null}
                      <Ionicons
                        name={result.kind === 'place' ? 'chevron-forward' : 'map-outline'}
                        size={18}
                        color={colors.textMuted}
                        style={styles.rowChevron}
                      />
                    </TouchableOpacity>
                  </React.Fragment>
                ))}
              </View>
            )}
            {found.total > found.results.length ? (
              <Text style={styles.footnote}>
                Showing {found.results.length} of {found.total} - keep typing to narrow it down.
              </Text>
            ) : null}
          </View>
        ) : (
          <>
            <View style={styles.tilesRow}>
              {tiles.map((tile) => (
                <TouchableOpacity
                  key={tile.label}
                  style={styles.tile}
                  onPress={tile.onPress}
                  accessibilityRole="button"
                >
                  <Ionicons name={tile.icon} size={24} color={colors.primary} />
                  <Text style={styles.tileLabel} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.3}>
                    {tile.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {savedPlaces.length > 0 ? (
              <TouchableOpacity
                style={[styles.group, styles.row, { marginBottom: 24 }]}
                onPress={() => navigation.navigate('SavedPlaces')}
                accessibilityRole="button"
              >
                <View style={styles.rowTile}>
                  <Ionicons name="heart" size={20} color={colors.saved} />
                </View>
                <View style={styles.rowTextWrap}>
                  <Text style={styles.rowTitle}>Saved places</Text>
                  <Text style={styles.rowSubtitle} numberOfLines={1}>
                    {savedPlaces.map((place) => place.name).join(', ')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={styles.rowChevron} />
              </TouchableOpacity>
            ) : null}

            <View style={[styles.sectionHeaderRow, model.featured.length === 0 && { display: 'none' }]}>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                {model.curated ? `Featured in ${resort.name}` : `Places to eat in ${resort.name}`}
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.hScroll}
              contentContainerStyle={styles.hScrollContent}
            >
              {model.featured.map((poi) => {
                const meta = categoryMeta[placeCategory(poi)] || categoryMeta.restaurant;
                return (
                  <TouchableOpacity
                    key={poi.id}
                    style={styles.featuredCard}
                    onPress={() => navigation.navigate('POIDetail', { poi })}
                    accessibilityRole="button"
                  >
                    <View style={[styles.featuredTile, { backgroundColor: meta.bg }]}>
                      <Ionicons name={poi.icon || meta.icon} size={24} color={meta.color} />
                    </View>
                    <Text style={styles.featuredTitle} numberOfLines={1}>
                      {poi.name}
                    </Text>
                    <Text style={styles.featuredSubtitle} numberOfLines={1}>
                      {poi.tagline || meta.singular}
                    </Text>
                    <Text style={styles.featuredSubtitle} numberOfLines={2}>
                      {nearLiftText(poi)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {model.partners.length > 0 ? (
              <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                Example partner offers
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Partners')}
                hitSlop={10}
                accessibilityRole="button"
              >
                <Text style={styles.sectionLink}>See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.hScroll}
              contentContainerStyle={styles.hScrollContent}
            >
              {model.partners.map((partner) => {
                const place = partner.placeId ? model.findPlace(partner.placeId) : null;
                return (
                  <TouchableOpacity
                    key={partner.id}
                    style={styles.partnerMini}
                    // Har partneren et sted i appen, åbnes det; ellers
                    // partner-listen, filtreret til partnerens kategori.
                    onPress={() =>
                      place
                        ? navigation.navigate('POIDetail', { poi: place })
                        : navigation.navigate('Partners', { category: partner.category, focusKey: Date.now() })
                    }
                    accessibilityRole="button"
                  >
                    <View style={styles.discountTile}>
                      <Text style={styles.discountTileNumber} maxFontSizeMultiplier={1.2}>
                        {partner.discount.split(' ')[0]}
                      </Text>
                      <Text style={styles.discountTileLabel} maxFontSizeMultiplier={1.2}>
                        off
                      </Text>
                    </View>
                    <View style={styles.rowTextWrap}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {partner.name}
                      </Text>
                      <Text style={styles.rowSubtitle} numberOfLines={1}>
                        {partner.categoryLabel}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
