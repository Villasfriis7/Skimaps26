import { colors } from '../styles/styles';

// Fælles udseende (ikon/farve/label) pr. stedkategori - bruges af kortet
// (filter-chips og markører), søgningen, detaljesiden og gemte steder, så de
// altid er i sync.
export const categoryMeta = {
  restaurant: { emoji: '🍽️', icon: 'restaurant-outline', label: 'Restaurants', bg: '#fbe0d7', color: colors.restaurant },
  cafe: { emoji: '☕', icon: 'cafe-outline', label: 'Cafés', bg: '#fdeed7', color: colors.cafe },
  apres_ski: { emoji: '🍷', icon: 'wine-outline', label: 'Après-ski', bg: '#f1e3f7', color: '#9b59b6' },
  hotel: { emoji: '🛏️', icon: 'bed-outline', label: 'Hotels', bg: '#e3edf7', color: colors.accent },
  ski_rental: { emoji: '🎿', icon: 'snow-outline', label: 'Ski rental', bg: '#e0f0f7', color: colors.primary },
};
