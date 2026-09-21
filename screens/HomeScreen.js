import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { styles, colors } from '../styles/styles';

// Velkomstskærm - starten på navigationen med to knapper videre i appen.
export default function HomeScreen({ navigation }) {
  return (
    <LinearGradient
      colors={[colors.deep, colors.primary, colors.accent]}
      style={styles.homeGradient}
    >
      <View style={styles.homeContent}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoEmoji}>🎿</Text>
        </View>
        <Text style={styles.brandTitle}>Skimaps</Text>
        <Text style={styles.brandTagline}>Find vej på pisterne - og til næste kaffepause</Text>

        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Map')}>
          <Text style={styles.primaryButtonIcon}>🗺️</Text>
          <Text style={styles.primaryButtonText}>Se kort</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('POIList')}>
          <Text style={styles.secondaryButtonIcon}>☕</Text>
          <Text style={styles.secondaryButtonText}>Cafeer & restauranter</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}
