import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Share, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { styles, colors } from '../styles/styles';
import { categoryMeta } from '../data/categoryMeta';
import { useSavedPlaces } from '../context/SavedPlacesContext';
import { useLocation } from '../context/LocationContext';
import { useResort } from '../context/ResortContext';
import { placeCategory, formatCuisine } from '../utils/places';
import { liftTypeLabels } from '../utils/pistes';
import { defaultStart, easiestWay, reachText } from '../utils/reach';
import { distanceMeters, formatDistance } from '../utils/geo';
import { isOpenNow, formatOpeningHours } from '../utils/openingHours';
import { websiteUrl, phoneUrl, openLink } from '../utils/links';

// Link, der åbner stedet i telefonens egen kort-app (til "Share").
const mapsLink = (place) =>
  Platform.OS === 'ios'
    ? `https://maps.apple.com/?ll=${place.latitude},${place.longitude}&q=${encodeURIComponent(place.name)}`
    : `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;

function InfoRow({ icon, children }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={18} color={colors.textMuted} />
      </View>
      <View style={{ flexShrink: 1 }}>{children}</View>
    </View>
  );
}

// Detaljeside for et enkelt sted - modtager stedet via route.params fra
// Explore/Map/Saved places. Viser de felter, der findes for stedet (OSM-steder
// har meget forskellig mængde info) - og siger det, når åbningstiderne
// mangler, i stedet for bare at udelade dem.
//
// "Nærmeste lift", "åben nu" og "kan jeg komme derhen på blå pister?"
// beregnes ud fra data i stedet for at være skrevet i hånden.
// Hjerte-knappen gemmer/fjerner stedet i AsyncStorage via SavedPlacesContext.
export default function POIDetailScreen({ navigation, route }) {
  const { poi } = route.params;
  const meta = categoryMeta[placeCategory(poi)] || categoryMeta.restaurant;
  const { isSaved, toggleSave } = useSavedPlaces();
  const { location } = useLocation();
  const { resort, model } = useResort();
  const saved = isSaved(poi.id);

  const nearest = model.nearestLiftStation(poi);
  const open = isOpenNow(poi.openingHours, model.timeZone); // true / false / null (ukendt)
  const cuisine = formatCuisine(poi.cuisine);
  const phone = phoneUrl(poi.phone);
  const website = websiteUrl(poi.website);
  // "Show on map" kræver, at stedet stadig findes i appens data.
  const onMap = model.findPlace(poi.id) !== null;

  // Hvor svært er det at komme derhen? Regnes fra brugerens position, hvis
  // den ligger i skiområdet - ellers fra områdets hovedlift.
  const start = defaultStart(model, location);
  const way = useMemo(
    () => easiestWay(model, start.point, poi),
    // start.point er et nyt objekt ved hver rendering - sammenlign på tallene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, start.point.latitude, start.point.longitude, poi]
  );
  const reach = reachText(way, start.label, model.convention);
  const away =
    location && distanceMeters(location, poi) < 30000
      ? `${formatDistance(distanceMeters(location, poi))} from you`
      : null;

  const showOnMap = () =>
    navigation.popTo('MainTabs', {
      screen: 'Map',
      params: { focusPlaceId: poi.id, focusKey: Date.now() },
    });

  const share = () =>
    Share.share({ message: `${poi.name} (${meta.singular.toLowerCase()} in ${resort.name})\n${mapsLink(poi)}` }).catch(
      () => {}
    );

  const actions = [
    onMap && { label: 'Map', icon: 'map-outline', onPress: showOnMap },
    phone && {
      label: 'Call',
      icon: 'call-outline',
      onPress: () => openLink(phone, 'This device cannot make phone calls.'),
    },
    website && { label: 'Website', icon: 'globe-outline', onPress: () => openLink(website) },
    { label: 'Share', icon: 'share-outline', onPress: share },
  ].filter(Boolean);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
      <StatusBar style="dark" />

      <View style={styles.detailHeader}>
        <View style={[styles.detailTile, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={26} color={meta.color} />
        </View>
        <View style={styles.rowTextWrap}>
          <Text style={styles.detailName} accessibilityRole="header">
            {poi.name}
          </Text>
          <Text style={styles.detailMeta}>
            {meta.singular}
            {open !== null ? ' · ' : ''}
            {open !== null ? (
              <Text style={open ? styles.openNow : styles.closedNow}>{open ? 'Open now' : 'Closed now'}</Text>
            ) : null}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={() => toggleSave(poi)}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remove from saved places' : 'Save place'}
          accessibilityState={{ selected: saved }}
        >
          <Ionicons
            name={saved ? 'heart' : 'heart-outline'}
            size={24}
            color={saved ? colors.saved : colors.primary}
          />
        </TouchableOpacity>
      </View>
      {saved ? (
        <Text style={[styles.footnote, { marginTop: -8, marginBottom: 12 }]}>
          Saved - you find it under Saved places on Explore and Profile.
        </Text>
      ) : null}

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('Route', { destination: poi })}
        accessibilityRole="button"
      >
        <Ionicons name="navigate" size={18} color={colors.white} style={styles.buttonIcon} />
        <Text style={styles.buttonText}>Route here</Text>
      </TouchableOpacity>

      <View style={[styles.actionRow, { marginBottom: 20 }]}>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.label}
            style={styles.actionTile}
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={action.label === 'Call' ? `Call ${poi.phone}` : action.label}
          >
            <Ionicons name={action.icon} size={22} color={colors.primary} />
            <Text style={styles.actionTileLabel} numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.card}>
        {poi.description ? <Text style={styles.cardText}>{poi.description}</Text> : null}

        {reach ? (
          <InfoRow icon={way.level.id === 'none' ? 'walk-outline' : 'trending-down-outline'}>
            <Text style={styles.infoText}>{reach}</Text>
          </InfoRow>
        ) : null}
        {nearest ? (
          <InfoRow icon="triangle-outline">
            <Text style={styles.infoText}>
              {formatDistance(nearest.meters)} from the {nearest.lift.name}{' '}
              {(liftTypeLabels[nearest.lift.liftType] || 'lift').toLowerCase()}
              {away ? ` · ${away}` : ''}
            </Text>
          </InfoRow>
        ) : null}
        {poi.address ? (
          <InfoRow icon="location-outline">
            <Text style={styles.infoText}>{poi.address}</Text>
          </InfoRow>
        ) : null}
        <InfoRow icon="time-outline">
          {poi.openingHours ? (
            formatOpeningHours(poi.openingHours).map((line) => (
              <Text key={line} style={styles.infoText}>
                {line}
              </Text>
            ))
          ) : (
            <Text style={styles.infoTextMuted}>
              Opening hours not listed{phone ? ' - call to check' : website ? ' - check the website' : ''}
            </Text>
          )}
        </InfoRow>
        {poi.phone ? (
          <InfoRow icon="call-outline">
            <Text style={styles.infoText}>{poi.phone}</Text>
          </InfoRow>
        ) : null}
        {cuisine ? (
          <InfoRow icon="restaurant-outline">
            <Text style={styles.infoText}>{cuisine}</Text>
          </InfoRow>
        ) : null}
      </View>

      <Text style={styles.footnote}>
        Place details come from OpenStreetMap and can be out of date.
      </Text>
    </ScrollView>
  );
}
