import React from 'react';
import { View, Text, TouchableOpacity, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles, colors } from '../styles/styles';
import { categoryMeta } from '../data/categoryMeta';
import { useSavedPlaces } from '../context/SavedPlacesContext';

// Detaljeside for et enkelt sted - modtager stedet via route.params fra
// Explore/Map. Viser altid de felter, der rent faktisk findes for stedet
// (kuraterede steder har beskrivelse/rute, rigtige OSM-steder kan i stedet
// have telefon/hjemmeside/åbningstider). Hjerte-knappen gemmer/fjerner stedet
// i AsyncStorage via SavedPlacesContext - det eneste rigtige, brugerstyrede
// data i appen, som huskes efter appen lukkes.
export default function POIDetailScreen({ route }) {
  const { poi } = route.params;
  const key = poi.category || poi.type;
  const meta = categoryMeta[key] || categoryMeta.restaurant;
  const { isSaved, toggleSave } = useSavedPlaces();
  const saved = isSaved(poi.id);

  const visRute = () => {
    Alert.alert('Rute til ' + poi.name, poi.route);
  };

  const ring = () => Linking.openURL(`tel:${poi.phone}`);
  const besøgHjemmeside = () => Linking.openURL(poi.website);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <TouchableOpacity style={styles.saveButton} onPress={() => toggleSave(poi)}>
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

        {poi.walkTime ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoRowIcon}>🚶</Text>
            <Text style={styles.infoRowText}>{poi.walkTime}</Text>
          </View>
        ) : null}
        {poi.address ? (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color={colors.textDark} style={{ marginRight: 8 }} />
            <Text style={styles.infoRowText}>{poi.address}</Text>
          </View>
        ) : null}
        {poi.openingHours ? (
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={16} color={colors.textDark} style={{ marginRight: 8 }} />
            <Text style={styles.infoRowText}>{poi.openingHours}</Text>
          </View>
        ) : null}
        {poi.cuisine ? (
          <View style={styles.infoRow}>
            <Ionicons name="restaurant-outline" size={16} color={colors.textDark} style={{ marginRight: 8 }} />
            <Text style={styles.infoRowText}>{poi.cuisine}</Text>
          </View>
        ) : null}
      </View>

      {poi.route ? (
        <TouchableOpacity style={styles.button} onPress={visRute}>
          <Text style={styles.buttonText}>🧭 Vis rute</Text>
        </TouchableOpacity>
      ) : null}
      {poi.phone ? (
        <TouchableOpacity style={styles.button} onPress={ring}>
          <Text style={styles.buttonText}>📞 Ring ({poi.phone})</Text>
        </TouchableOpacity>
      ) : null}
      {poi.website ? (
        <TouchableOpacity style={styles.button} onPress={besøgHjemmeside}>
          <Text style={styles.buttonText}>🌐 Besøg hjemmeside</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
