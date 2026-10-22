import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { partners, partnerCategories } from '../data/partners';
import { styles, colors } from '../styles/styles';

// Partners-fanen - viser rabatter/tilbud hos lokale partnere i Verbier.
// Mock-data, da der ikke er nogen rigtig partner-/kode-integration endnu.
export default function PartnersScreen() {
  const [activeCategory, setActiveCategory] = useState('all');

  const filtered =
    activeCategory === 'all' ? partners : partners.filter((p) => p.category === activeCategory);

  const showCode = (partner) => {
    Alert.alert(partner.name, `Din rabatkode: ${partner.code}\n\nVis den ved kassen.`);
  };

  const renderPartner = ({ item }) => (
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
        <Text style={styles.partnerCardDistance}>{item.distance}</Text>
        <TouchableOpacity style={styles.showCodeButton} onPress={() => showCode(item)}>
          <Text style={styles.showCodeButtonText}>Show code</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenHeaderTitle}>Partners</Text>
        <Text style={styles.screenHeaderSubtitle}>📍 Verbier</Text>
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
