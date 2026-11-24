import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSavedPlaces } from '../context/SavedPlacesContext';
import { categoryMeta } from '../data/categoryMeta';
import { placeCategory } from '../utils/places';
import { styles, colors } from '../styles/styles';

// Viser brugerens gemte steder - rigtige data fra AsyncStorage (via
// SavedPlacesContext), ikke hardcoded. Listen er tom, indtil brugeren selv
// trykker på hjerte-knappen på et steds detaljeside.
export default function SavedPlacesScreen({ navigation }) {
  const { savedPlaces, removeSaved } = useSavedPlaces();

  if (savedPlaces.length === 0) {
    return (
      <View style={styles.centeredContainer}>
        <StatusBar style="light" />
        <Ionicons name="heart-outline" size={48} color={colors.textMuted} />
        <Text style={[styles.subtitle, { marginTop: 12, textAlign: 'center' }]}>
          No saved places yet
        </Text>
        <Text style={[styles.mutedText, { textAlign: 'center', marginTop: 4 }]}>
          Tap the heart on a place to save it here.
        </Text>
      </View>
    );
  }

  const renderItem = ({ item }) => {
    const meta = categoryMeta[placeCategory(item)] || categoryMeta.restaurant;
    return (
      <TouchableOpacity
        style={styles.listItem}
        onPress={() => navigation.navigate('POIDetail', { poi: item })}
      >
        <View style={[styles.listItemIconWrap, { backgroundColor: meta.bg }]}>
          <Text style={styles.listItemIcon}>{meta.emoji}</Text>
        </View>
        <View style={styles.listItemTextWrap}>
          <Text style={styles.listItemTitle}>{item.name}</Text>
          <Text style={styles.listItemSubtitle}>{meta.label}</Text>
        </View>
        <TouchableOpacity
          onPress={() => removeSaved(item.id)}
          hitSlop={10}
          accessibilityLabel={`Remove ${item.name} from saved places`}
        >
          <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.screenHeader}>
        <Text style={styles.screenHeaderSubtitle}>
          {savedPlaces.length} saved {savedPlaces.length === 1 ? 'place' : 'places'}
        </Text>
      </View>
      <FlatList
        data={savedPlaces}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
