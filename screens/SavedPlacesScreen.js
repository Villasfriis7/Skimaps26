import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSavedPlaces } from '../context/SavedPlacesContext';
import { useResort } from '../context/ResortContext';
import { categoryMeta } from '../data/categoryMeta';
import { placeCategory } from '../utils/places';
import { formatDistance } from '../utils/geo';
import { styles, colors } from '../styles/styles';

const UNDO_MS = 6000;

// Viser brugerens gemte steder - rigtige data fra AsyncStorage (via
// SavedPlacesContext), ikke hardcoded. Listen er tom, indtil brugeren selv
// trykker på hjerte-knappen på et sted.
//
// Et sted fjernes med ét tryk, men kan hentes tilbage med "Undo" i nogle
// sekunder - et fejltryk med handsker skal ikke koste et gemt sted.
export default function SavedPlacesScreen({ navigation }) {
  const { savedPlaces, savedElsewhere, removeSaved, toggleSave } = useSavedPlaces();
  const { resort, model } = useResort();
  const elsewhere =
    savedElsewhere > 0
      ? `You also have ${savedElsewhere} saved ${savedElsewhere === 1 ? 'place' : 'places'} in other resorts.`
      : null;
  const [removed, setRemoved] = useState(null);
  const undoTimer = useRef(null);

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  const remove = (place) => {
    removeSaved(place.id);
    setRemoved(place);
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setRemoved(null), UNDO_MS);
  };

  const undo = () => {
    if (removed) toggleSave(removed);
    setRemoved(null);
    clearTimeout(undoTimer.current);
  };

  const undoBar = removed ? (
    <View style={styles.undoBar}>
      <Text style={styles.undoBarText} numberOfLines={1}>
        Removed {removed.name}
      </Text>
      <TouchableOpacity onPress={undo} style={styles.undoBarButton} accessibilityRole="button">
        <Text style={styles.undoBarButtonText}>Undo</Text>
      </TouchableOpacity>
    </View>
  ) : null;

  if (savedPlaces.length === 0) {
    return (
      <View style={styles.centered}>
        <StatusBar style="dark" />
        <Ionicons name="heart-outline" size={48} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No saved places in {resort.name} yet</Text>
        <Text style={[styles.emptyText, { marginBottom: 20 }]}>
          Tap the heart on a restaurant, bar or hotel to keep it here.{elsewhere ? ` ${elsewhere}` : ''}
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.popTo('MainTabs', { screen: 'Map' })}
        >
          <Ionicons name="map-outline" size={18} color={colors.white} style={styles.buttonIcon} />
          <Text style={styles.buttonText}>Find places on the map</Text>
        </TouchableOpacity>
        {undoBar}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.group}>
          {savedPlaces.map((item, index) => {
            const meta = categoryMeta[placeCategory(item)] || categoryMeta.restaurant;
            const nearest = model.nearestLiftStation(item);
            return (
              <React.Fragment key={item.id}>
                {index > 0 ? <View style={styles.rowDivider} /> : null}
                {/* Rækken er en almindelig View med to knapper ved siden af
                    hinanden (åbn / fjern), så skærmlæsere kan nå dem begge. */}
                <View style={styles.row}>
                  <TouchableOpacity
                    style={styles.rowMain}
                    onPress={() => navigation.navigate('POIDetail', { poi: item })}
                    accessibilityRole="button"
                  >
                    <View style={[styles.rowTile, { backgroundColor: meta.bg }]}>
                      <Ionicons name={meta.icon} size={20} color={meta.color} />
                    </View>
                    <View style={styles.rowTextWrap}>
                      <Text style={styles.rowTitle}>{item.name}</Text>
                      <Text style={styles.rowSubtitle}>
                        {meta.singular}
                        {nearest ? ` · ${formatDistance(nearest.meters)} from ${nearest.lift.name} lift` : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rowAction}
                    onPress={() => remove(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${item.name} from saved places`}
                  >
                    <Ionicons name="heart" size={22} color={colors.saved} />
                  </TouchableOpacity>
                </View>
              </React.Fragment>
            );
          })}
        </View>
        <Text style={styles.footnote}>
          Tap the heart to remove a place from the list.{elsewhere ? ` ${elsewhere}` : ''}
        </Text>
      </ScrollView>
      {undoBar}
    </View>
  );
}
