import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { partnerCategories } from '../data/partners';
import { useResort } from '../context/ResortContext';
import { formatDistance } from '../utils/geo';
import { styles, colors } from '../styles/styles';

// Hvor ligger partneren? Har partneren et rigtigt sted i appens data, regner
// vi afstanden til nærmeste lift ud - ellers bruger vi partnerens egen tekst.
function partnerLocation(model, partner) {
  const place = partner.placeId ? model.findPlace(partner.placeId) : null;
  if (!place) return partner.location || '';
  const nearest = model.nearestLiftStation(place);
  return `${formatDistance(nearest.meters)} from ${nearest.lift.name} lift`;
}

// Partners-fanen - viser rabatter/tilbud hos lokale partnere i Verbier.
// Eksempeldata: virksomhederne findes, men tilbud og koder er opdigtede, og
// det står både øverst på skærmen og i selve kode-boksen. Partnere, der
// findes som sted i appen, har en "View place"-knap til detaljesiden.
//
// route.params.category (fra Explore) vælger en kategori på forhånd.
//
// Eksempel-partnerne findes kun for Verbier. I andre skiområder siger fanen
// det, i stedet for at opdigte tilbud hos rigtige virksomheder.
export default function PartnersScreen({ navigation, route }) {
  const { resort, model } = useResort();
  const { partners } = model;
  const [activeCategory, setActiveCategory] = useState('all');

  const requested = route.params?.category;
  const focusKey = route.params?.focusKey;
  useEffect(() => {
    if (requested) setActiveCategory(requested);
  }, [requested, focusKey]);

  const filtered =
    activeCategory === 'all' ? partners : partners.filter((p) => p.category === activeCategory);

  const showCode = (partner) => {
    Alert.alert(
      `Example code: ${partner.code}`,
      `In the finished app you show this code when you pay. ${partner.name} is not a SkiMaps partner yet, so it will not work today - this is an example of how an offer will look.`
    );
  };

  const renderPartner = ({ item }) => {
    const place = item.placeId ? model.findPlace(item.placeId) : null;
    return (
      <View style={styles.partnerCard}>
        <View style={styles.partnerTop}>
          <View style={styles.discountTile}>
            <Text style={styles.discountTileNumber} maxFontSizeMultiplier={1.2}>
              {item.discount.split(' ')[0]}
            </Text>
            <Text style={styles.discountTileLabel} maxFontSizeMultiplier={1.2}>
              off
            </Text>
          </View>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowTitle}>{item.name}</Text>
            <Text style={styles.rowSubtitle}>{item.categoryLabel}</Text>
          </View>
        </View>
        <Text style={styles.partnerDescription}>{item.description}</Text>
        <View style={styles.partnerLocationRow}>
          <Ionicons name="location-outline" size={14} color={colors.textMuted} />
          <Text style={styles.partnerLocation}>{partnerLocation(model, item)}</Text>
        </View>
        <View style={styles.partnerActions}>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => showCode(item)}
            accessibilityRole="button"
          >
            <Text style={styles.smallButtonText}>Show code</Text>
          </TouchableOpacity>
          {place ? (
            <TouchableOpacity
              style={styles.smallButton}
              onPress={() => navigation.navigate('POIDetail', { poi: place })}
              accessibilityRole="button"
            >
              <Text style={styles.smallButtonText}>View place</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  const chips = [{ id: 'all', name: 'All', icon: 'apps-outline' }, ...partnerCategories];

  if (partners.length === 0) {
    return (
      <SafeAreaView style={styles.tabScreen} edges={['top']}>
        <View style={styles.screenHeader}>
          <Text style={styles.screenTitle} accessibilityRole="header">
            Partners
          </Text>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="pricetags-outline" size={40} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No offers in {resort.name}</Text>
          <Text style={styles.emptyText}>
            The example partner offers in this demo are only set up for Verbier.
          </Text>
          <TouchableOpacity
            style={[styles.buttonSecondary, { marginTop: 20 }]}
            onPress={() => navigation.navigate('Resorts')}
            accessibilityRole="button"
          >
            <Text style={styles.buttonSecondaryText}>Change resort</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.tabScreen} edges={['top']}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle} accessibilityRole="header">
          Partners
        </Text>
        <Text style={styles.screenSubtitle}>Example offers - not real partnerships yet</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsRow}
        contentContainerStyle={styles.chipsContent}
      >
        {chips.map((cat) => {
          const active = activeCategory === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setActiveCategory(cat.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Ionicons name={cat.icon} size={16} color={active ? colors.white : colors.textDark} />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderPartner}
        showsVerticalScrollIndicator={false}
        style={styles.listBleed}
        contentContainerStyle={[styles.listBleedContent, { paddingTop: 4 }]}
      />
    </SafeAreaView>
  );
}
