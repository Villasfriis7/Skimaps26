import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { categoryMeta } from '../data/categoryMeta';
import { useLocation } from '../context/LocationContext';
import { useResort } from '../context/ResortContext';
import { useSavedPlaces } from '../context/SavedPlacesContext';
import { placeCategory } from '../utils/places';
import { findRoute } from '../utils/routing';
import { defaultStart } from '../utils/reach';
import { skillLabel } from '../utils/pistes';
import { distanceMeters, formatDistance, formatDuration } from '../utils/geo';
import { isOpenNow } from '../utils/openingHours';
import { useBottomSpace } from '../utils/safeArea';
import { styles, colors } from '../styles/styles';

// "Hvor kan vi spise?" som en liste i stedet for et kort fuldt af prikker:
// alle steder i én kategori, nærmeste først, med "åben nu" hvor vi ved det.
//
// Filtrene "Without skis" og "Blue pistes" bruger rutefindingen: de viser kun
// steder, man kan nå fra sin position (eller fra Médran) uden at skulle ned
// ad noget sværere. Det er spørgsmålet, en begynder eller en uden ski har.
// Med et af dem slået til står rutens tid i hver række, og listen sorteres
// efter den - så er "24 min, 2 lifts" svaret, ikke fugleflugt.
//
// "On the mountain" skjuler landsbyens steder: "hvor kan vi spise frokost på
// pisten?" druknede ellers i de tyve restauranter omkring hotellet.
const reachFilters = [
  { id: 'all', label: 'All', icon: 'apps-outline' },
  { id: 'none', label: 'Without skis', icon: 'walk-outline' },
  // Teksten sættes ud fra landets pistefarver: "Blue pistes" / "Green pistes".
  { id: 'easy', label: null, icon: 'trending-down-outline' },
];

export default function PlacesListScreen({ navigation, route }) {
  const bottomSpace = useBottomSpace();
  const { category } = route.params;
  const meta = categoryMeta[category];
  const { location } = useLocation();
  const [reach, setReach] = useState('all');
  const [mountainOnly, setMountainOnly] = useState(false);
  const { model } = useResort();
  const { isSaved } = useSavedPlaces();
  const { allPlaces } = model;
  const graph = model.getGraph();
  const easyColor = skillLabel('easy', model.convention);
  const start = defaultStart(model, location);

  // Afstande måles fra brugeren, når vi ved, hvor de er - ellers fra Médran.
  const nearby = location && distanceMeters(location, start.point) < 30000;
  const origin = nearby ? location : start.point;
  const originLabel = nearby ? 'you' : start.label;

  const places = useMemo(
    () =>
      allPlaces
        .filter((place) => placeCategory(place) === category)
        .map((place) => ({
          place,
          meters: distanceMeters(origin, place),
          open: isOpenNow(place.openingHours, model.timeZone),
        }))
        .sort((a, b) => a.meters - b.meters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allPlaces, category, origin.latitude, origin.longitude]
  );

  const shown = useMemo(
    () => {
      const wanted = mountainOnly ? places.filter(({ place }) => model.onMountain(place)) : places;
      if (reach === 'all') return wanted;
      return wanted
        .map((item) => ({
          ...item,
          way: findRoute(graph, start.point, item.place, { skill: reach, convention: model.convention }),
        }))
        .filter((item) => item.way !== null)
        .sort((a, b) => a.way.totalSeconds - b.way.totalSeconds);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [places, reach, mountainOnly, graph, start.point.latitude, start.point.longitude]
  );
  // Vis kun "On the mountain", hvor det giver mening: kategorien skal have
  // steder både i byen og på bjerget.
  const mountainCount = useMemo(
    () => places.filter(({ place }) => model.onMountain(place)).length,
    [places, model]
  );
  const showMountainChip = mountainCount > 0 && mountainCount < places.length;

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
              <Text style={[styles.chipText, on && styles.chipTextActive]}>
                {filter.label || `${easyColor} pistes`}
              </Text>
            </TouchableOpacity>
          );
        })}
        {showMountainChip ? (
          <TouchableOpacity
            style={[styles.chip, mountainOnly && styles.chipActive]}
            onPress={() => setMountainOnly((on) => !on)}
            accessibilityRole="switch"
            accessibilityState={{ checked: mountainOnly }}
          >
            <Ionicons
              name={mountainOnly ? 'checkmark' : 'triangle-outline'}
              size={16}
              color={mountainOnly ? colors.white : colors.textDark}
            />
            <Text style={[styles.chipText, mountainOnly && styles.chipTextActive]}>On the mountain</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={[styles.screenSubtitle, { marginTop: 0, marginBottom: 12 }]}>
        {shown.length} {shown.length === 1 ? meta.singular.toLowerCase() : meta.label.toLowerCase()}
        {mountainOnly ? ' on the mountain' : ''} ·{' '}
        {reach === 'all' ? `nearest to ${originLabel} first` : 'quickest to reach first'}
        {reach === 'none' ? ` · reachable from ${start.label} on foot and by gondola` : ''}
        {reach === 'easy' ? ` · reachable from ${start.label} on ${easyColor.toLowerCase()} pistes or easier` : ''}
      </Text>
    </View>
  );

  const renderItem = ({ item, index }) => {
    const { place, meters, open, way } = item;
    const lifts = way ? way.steps.filter((step) => step.kind === 'lift').length : 0;
    // Med et filter slået til: rutens tid fra startpunktet i stedet for fugleflugt.
    const reachLine = way
      ? way.steps.length === 0
        ? 'Right here'
        : `${formatDuration(way.totalSeconds)} from ${start.label}${lifts ? ` · ${lifts} ${lifts === 1 ? 'lift' : 'lifts'}` : ' · on foot'}`
      : `${formatDistance(meters)} from ${originLabel}`;
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
            {reachLine}
            {open !== null ? ' · ' : ''}
            {open !== null ? (
              <Text style={open ? styles.openNow : styles.closedNow}>{open ? 'Open now' : 'Closed now'}</Text>
            ) : null}
          </Text>
        </View>
        {/* Gemte steder er markeret med et hjerte. */}
        {isSaved(place.id) ? <Ionicons name="heart" size={18} color={colors.saved} /> : null}
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
            <Text style={styles.emptyTitle}>
              {reach === 'all' && !mountainOnly ? `No ${meta.label.toLowerCase()} in ${model.name}` : 'Nothing within reach'}
            </Text>
            <Text style={styles.emptyText}>
              {reach === 'all' && !mountainOnly
                ? 'OpenStreetMap has none listed for this ski area.'
                : `No ${meta.label.toLowerCase()} can be reached from ${start.label} this way. Try "All".`}
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
        contentContainerStyle={[styles.listBleedContent, { paddingTop: 16, paddingBottom: bottomSpace }]}
        initialNumToRender={14}
      />
    </View>
  );
}
