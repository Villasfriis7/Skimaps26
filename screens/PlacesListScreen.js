import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { categoryMeta } from '../data/categoryMeta';
import { useLocation } from '../context/LocationContext';
import { getSkiGraph } from '../context/RouteContext';
import { allPlaces, placeCategory } from '../utils/places';
import { findRoute } from '../utils/routing';
import { defaultStart } from '../utils/reach';
import { distanceMeters, formatDistance } from '../utils/geo';
import { isOpenNow } from '../utils/openingHours';
import { styles, colors } from '../styles/styles';

// "Hvor kan vi spise?" som en liste i stedet for et kort fuldt af prikker:
// alle steder i én kategori, nærmeste først, med "åben nu" hvor vi ved det.
//
// Filtrene "Without skis" og "Blue pistes" bruger rutefindingen: de viser kun
// steder, man kan nå fra sin position (eller fra Médran) uden at skulle ned
// ad noget sværere. Det er spørgsmålet, en begynder eller en uden ski har.
const reachFilters = [
  { id: 'all', label: 'All', icon: 'apps-outline' },
  { id: 'none', label: 'Without skis', icon: 'walk-outline' },
  { id: 'easy', label: 'Blue pistes', icon: 'trending-down-outline' },
];

export default function PlacesListScreen({ navigation, route }) {
  const { category } = route.params;
  const meta = categoryMeta[category];
  const { location } = useLocation();
  const [reach, setReach] = useState('all');
  const graph = getSkiGraph();
  const start = defaultStart(graph, location);

  // Afstande måles fra brugeren, når vi ved, hvor de er - ellers fra Médran.
  const nearby = location && distanceMeters(location, start.point) < 30000;
  const origin = nearby ? location : start.point;
  const originLabel = nearby ? 'you' : start.label;

  const places = useMemo(
    () =>
      allPlaces
        .filter((place) => placeCategory(place) === category)
        .map((place) => ({ place, meters: distanceMeters(origin, place), open: isOpenNow(place.openingHours) }))
        .sort((a, b) => a.meters - b.meters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [category, origin.latitude, origin.longitude]
  );

  const shown = useMemo(
    () =>
      reach === 'all'
        ? places
        : places.filter(({ place }) => findRoute(graph, start.point, place, { skill: reach }) !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [places, reach, graph, start.point.latitude, start.point.longitude]
  );

  const showOnMap = () =>
    navigation.popTo('MainTabs', {
      screen: 'Map',
      params: { focusCategory: category, focusKey: Date.now() },
    });

  const header = (
    <View>
      <View style={[styles.chipsWrap, { marginBottom: 12 }]}>
        {reachFilters.map((filter) => {
          const on = reach === filter.id;
          return (
            <TouchableOpacity
              key={filter.id}
              style={[styles.chip, on && styles.chipActive]}
              onPress={() => setReach(filter.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Ionicons name={filter.icon} size={16} color={on ? colors.white : colors.textDark} />
              <Text style={[styles.chipText, on && styles.chipTextActive]}>{filter.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.screenSubtitle, { marginTop: 0, marginBottom: 12 }]}>
        {shown.length} {shown.length === 1 ? meta.singular.toLowerCase() : meta.label.toLowerCase()} · nearest to{' '}
        {originLabel} first
        {reach === 'none' ? ` · reachable from ${start.label} on foot and by gondola` : ''}
        {reach === 'easy' ? ` · reachable from ${start.label} on blue pistes or easier` : ''}
      </Text>
    </View>
  );

  const renderItem = ({ item, index }) => {
    const { place, meters, open } = item;
    const first = index === 0;
    const last = index === shown.length - 1;
    return (
      <TouchableOpacity
        style={[
          styles.row,
          { backgroundColor: colors.white },
          first && { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
          last && { borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
        ]}
        onPress={() => navigation.navigate('POIDetail', { poi: place })}
        accessibilityRole="button"
      >
        <View style={[styles.rowTile, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={20} color={meta.color} />
        </View>
        <View style={styles.rowTextWrap}>
          <Text style={styles.rowTitle}>{place.name}</Text>
          <Text style={styles.rowSubtitle}>
            {formatDistance(meters)} from {originLabel}
            {open !== null ? ' · ' : ''}
            {open !== null ? (
              <Text style={open ? styles.openNow : styles.closedNow}>{open ? 'Open now' : 'Closed now'}</Text>
            ) : null}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={styles.rowChevron} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.screen, { paddingHorizontal: 20 }]}>
      <StatusBar style="dark" />
      <FlatList
        data={shown}
        keyExtractor={(item) => item.place.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => (
          <View style={{ backgroundColor: colors.white }}>
            <View style={styles.rowDivider} />
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name={meta.icon} size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Nothing within reach</Text>
            <Text style={styles.emptyText}>
              No {meta.label.toLowerCase()} can be reached from {start.label} this way. Try "All".
            </Text>
          </View>
        }
        ListFooterComponent={
          <TouchableOpacity style={[styles.buttonSecondary, { marginTop: 16 }]} onPress={showOnMap}>
            <Ionicons name="map-outline" size={18} color={colors.primary} style={styles.buttonIcon} />
            <Text style={styles.buttonSecondaryText}>Show {meta.label.toLowerCase()} on the map</Text>
          </TouchableOpacity>
        }
        showsVerticalScrollIndicator={false}
        style={styles.listBleed}
        contentContainerStyle={[styles.listBleedContent, { paddingTop: 16 }]}
        initialNumToRender={14}
      />
    </View>
  );
}
