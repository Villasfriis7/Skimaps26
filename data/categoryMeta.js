import { colors } from '../styles/styles';

// Fælles udseende (ikon/farve/label) pr. stedkategori - bruges af kortet
// (filter-chips og markører), søgningen, detaljesiden og gemte steder, så de
// altid er i sync. `label` er flertal (filter-chips), `singular` bruges om ét sted.
export const categoryMeta = {
  restaurant: { icon: 'restaurant-outline', label: 'Restaurants', singular: 'Restaurant', bg: '#fbe0d7', color: colors.restaurant },
  cafe: { icon: 'cafe-outline', label: 'Cafés', singular: 'Café', bg: '#fdeed7', color: colors.cafe },
  apres_ski: { icon: 'wine-outline', label: 'Après-ski', singular: 'Après-ski', bg: '#f1e3f7', color: colors.apres },
  hotel: { icon: 'bed-outline', label: 'Hotels', singular: 'Hotel', bg: '#e3edf7', color: colors.hotel },
  ski_rental: { icon: 'snow-outline', label: 'Ski rental', singular: 'Ski rental', bg: '#e0f0f7', color: colors.primary },
};
