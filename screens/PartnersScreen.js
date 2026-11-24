import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { partners, partnerCategories } from '../data/partners';
import { findPlace, nearestLiftStation } from '../utils/places';
import { formatDistance } from '../utils/geo';
import { styles, colors } from '../styles/styles';

// Hvor ligger partneren? Har partneren et rigtigt sted i appens data, regner
// vi afstanden til nærmeste lift ud - ellers bruger vi partnerens egen tekst.
function partnerLocation(partner) {
  const place = partner.placeId ? findPlace(partner.placeId) : null;
  if (!place) return partner.location || '';
  const nearest = nearestLiftStation(place);
  return `${formatDistance(nearest.meters)} from ${nearest.lift.name}`;
}

// Partners-fanen - viser rabatter/tilbud hos lokale partnere i Verbier.
// Mock-data: virksomhederne findes, men tilbud og koder er eksempler, og det
// står øverst på skærmen. Partnere, der findes som sted i appen, har en
// "View place"-knap til detaljesiden.
export default function PartnersScreen({ navigation }) {
  const [activeCategory, setActiveCategory] = useState('all');

  const filtered =
    activeCategory === 'all' ? partners : partners.filter((p) => p.category === activeCategory);

  const showCode = (partner) => {
    Alert.alert(partner.name, `Your discount code: ${partner.code}\n\nShow it when you pay.`);
  };

  const renderPartner = ({ item }) => {
    const place = item.placeId ? findPlace(item.placeId) : null;
    return (
      <View style={styles.partnerCard}>
        <View style={styles.partnerCardIconWrap}>
          <Ionicons
            name={partnerCategories.find((c) => c.id === item.category)?.icon || 'pricetag-outline'}
            size={26}
            color={colors.primary}
          />
        </View>
        <View style={styles.partnerCardBody}>
          <View style={styles.partnerCardTopRow}>
            <Text style={styles.partnerCardName}>{item.name}</Text>
            <View style={styles.partnerDiscountBadge}>
              <Text style={styles.partnerDiscountText}>{item.discount}</Text>
            </View>
          </View>
          <Text style={styles.partnerCardCategory}>{item.categoryLabel}</Text>
          <Text style={styles.partnerCardDescription}>{item.description}</Text>
          <Text style={styles.partnerCardDistance}>📍 {partnerLocation(item)}</Text>
          <View style={styles.partnerCardActions}>
            <TouchableOpacity style={styles.showCodeButton} onPress={() => showCode(item)}>
              <Text style={styles.showCodeButtonText}>Show code</Text>
            </TouchableOpacity>
            {place ? (
              <TouchableOpacity
                style={styles.showCodeButton}
                onPress={() => navigation.navigate('POIDetail', { poi: place })}
              >
                <Text style={styles.showCodeButtonText}>View place</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenHeaderTitle}>Partners</Text>
        <Text style={styles.screenHeaderSubtitle}>
          📍 Verbier · demo offers, not real partnerships yet
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryChipsRow}
        contentContainerStyle={{ alignItems: 'center' }}
      >
        <TouchableOpacity
          style={[styles.categoryChip, activeCategory === 'all' && styles.categoryChipActive]}
          onPress={() => setActiveCategory('all')}
        >
          <Ionicons
            name="apps-outline"
            size={15}
            color={activeCategory === 'all' ? colors.white : colors.textDark}
          />
          <Text
            style={[
              styles.categoryChipText,
              activeCategory === 'all' && styles.categoryChipTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        {partnerCategories.map((cat) => {
          const active = activeCategory === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryChip, active && styles.categoryChipActive]}
              onPress={() => setActiveCategory(cat.id)}
            >
              <Ionicons name={cat.icon} size={15} color={active ? colors.white : colors.textDark} />
              <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderPartner}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}
