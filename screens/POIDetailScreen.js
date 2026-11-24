import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { styles, colors } from '../styles/styles';
import { categoryMeta } from '../data/categoryMeta';
import { useSavedPlaces } from '../context/SavedPlacesContext';
import { placeCategory, nearestLiftStation, formatCuisine, findPlace } from '../utils/places';
import { liftTypeLabels } from '../utils/pistes';
import { formatDistance } from '../utils/geo';
import { isOpenNow } from '../utils/openingHours';
import { websiteUrl, phoneUrl, openLink } from '../utils/links';

// Detaljeside for et enkelt sted - modtager stedet via route.params fra
// Explore/Map/Saved places. Viser kun de felter, der rent faktisk findes for
// stedet (OSM-steder har meget forskellig mængde info). "Nærmeste lift" og
// "åben nu" beregnes ud fra data i stedet for at være skrevet i hånden.
// Hjerte-knappen gemmer/fjerner stedet i AsyncStorage via SavedPlacesContext.
export default function POIDetailScreen({ navigation, route }) {
  const { poi } = route.params;
  const meta = categoryMeta[placeCategory(poi)] || categoryMeta.restaurant;
  const { isSaved, toggleSave } = useSavedPlaces();
  const saved = isSaved(poi.id);

  const nearest = nearestLiftStation(poi);
  const open = isOpenNow(poi.openingHours); // true / false / null (ukendt)
  const cuisine = formatCuisine(poi.cuisine);
  const phone = phoneUrl(poi.phone);
  const website = websiteUrl(poi.website);
  // "Show on map" kræver, at stedet stadig findes i appens data.
  const onMap = findPlace(poi.id) !== null;

  const showOnMap = () =>
    navigation.popTo('MainTabs', {
      screen: 'Map',
      params: { focusPlaceId: poi.id, focusKey: Date.now() },
    });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Headeren er mørkeblå, så statusbarens tekst skal være lys her */}
      <StatusBar style="light" />
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={() => toggleSave(poi)}
          accessibilityLabel={saved ? 'Remove from saved places' : 'Save place'}
        >
          <Ionicons
            name={saved ? 'heart' : 'heart-outline'}
            size={20}
            color={saved ? colors.restaurant : colors.primary}
          />
        </TouchableOpacity>

        <View style={[styles.detailIconCircle, { backgroundColor: meta.bg }]}>
          <Text style={styles.detailIconEmoji}>{meta.emoji}</Text>
        </View>

        <View style={[styles.badge, { backgroundColor: meta.color }]}>
          <Text style={styles.badgeText}>{meta.label}</Text>
        </View>

        <Text style={[styles.subtitle, { textAlign: 'center' }]}>{poi.name}</Text>
        {poi.description ? <Text style={styles.cardText}>{poi.description}</Text> : null}

        {nearest ? (
          <View style={styles.infoRow}>
            <Ionicons name="triangle-outline" size={16} color={colors.textDark} style={styles.infoRowIonicon} />
            <Text style={styles.infoRowText}>
              {formatDistance(nearest.meters)} from {nearest.lift.name} (
              {(liftTypeLabels[nearest.lift.liftType] || 'lift').toLowerCase()},{' '}
              {nearest.end === 'bottom' ? 'bottom station' : 'top station'})
            </Text>
          </View>
        ) : null}
        {poi.address ? (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color={colors.textDark} style={styles.infoRowIonicon} />
            <Text style={styles.infoRowText}>{poi.address}</Text>
          </View>
        ) : null}
        {poi.openingHours ? (
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={16} color={colors.textDark} style={styles.infoRowIonicon} />
            <Text style={styles.infoRowText}>
              {open !== null ? (
                <Text style={open ? styles.openNow : styles.closedNow}>
                  {open ? 'Open now' : 'Closed now'}
                  {'  '}
                </Text>
              ) : null}
              {poi.openingHours}
            </Text>
          </View>
        ) : null}
        {cuisine ? (
          <View style={styles.infoRow}>
            <Ionicons name="restaurant-outline" size={16} color={colors.textDark} style={styles.infoRowIonicon} />
            <Text style={styles.infoRowText}>{cuisine}</Text>
          </View>
        ) : null}
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('Route', { destination: poi })}
      >
        <Text style={styles.buttonText}>🧭 Route here</Text>
      </TouchableOpacity>
      {onMap ? (
        <TouchableOpacity style={styles.buttonOutline} onPress={showOnMap}>
          <Text style={styles.buttonOutlineText}>🗺️ Show on map</Text>
        </TouchableOpacity>
      ) : null}
      {phone ? (
        <TouchableOpacity
          style={styles.buttonOutline}
          onPress={() => openLink(phone, 'This device cannot make phone calls.')}
        >
          <Text style={styles.buttonOutlineText}>📞 Call {poi.phone}</Text>
        </TouchableOpacity>
      ) : null}
      {website ? (
        <TouchableOpacity style={styles.buttonOutline} onPress={() => openLink(website)}>
          <Text style={styles.buttonOutlineText}>🌐 Visit website</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}
